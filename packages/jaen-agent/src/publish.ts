/**
 * Publish: the only writer of history.
 *
 * `docs/architecture/draft-state.md`, and `okf/decisions/hard-rules.md`
 * ("The CMS's draft is not the site's content"): a draft is mutable, shared
 * and worth nothing once it is published; a migration is immutable, permanent
 * and is the site's content. The ordered collection of migrations, and
 * nothing else, is what live and published mean. So exactly one act writes a
 * repository, and this is it:
 *
 *   1. read the draft out of the store,
 *   2. write one migration file in jaen's shape, `{message, createdAt, data}`,
 *   3. upload it to the storage gateway with the site's machine token, and
 *      read it back before anything is committed,
 *   4. append its URL as one line to `jaen-data/patches.txt`,
 *   5. commit that one line, in the publishing editor's name,
 *   6. record `publishedRevision` in the draft store,
 *   7. trigger the build where the site has one, and say so honestly where it
 *      does not.
 *
 * Nothing else in this service may write to a repository.
 *
 * The draft store is `./draft/store`, four operations for the editors and
 * `markPublished` beside them, which only this path calls. Publish knows no
 * Cloudflare type and no Durable Object, which is the escape the design asks
 * for: a store over one process with SQLite implements the same interface and
 * nothing here moves.
 *
 * **The order is the safety.** The gateway file is written before the commit,
 * so a failure between the two leaves a file nothing names, which costs a few
 * kilobytes on the gateway and changes no site. The commit is made before the
 * mark, so a failure between those two leaves a published migration the store
 * still calls unpublished, and the CMS then says "not published" about
 * something that is. Both failures err towards understating what is live,
 * which is the direction that cannot lose an edit and cannot leak an
 * unpublished one. The reverse order of either pair could publish content the
 * chain does not name, or name a file that is not there.
 */
import {PATCHES_PATH} from './document'
import type {DraftStore} from './draft/store'
import {siteBranch, sitePath, type SiteEntry} from './env'
import {readBackMigration, uploadMigration} from './gateway'
import {
  ConflictError,
  dispatchWorkflow,
  latestRunUrl,
  readFile,
  writeFile,
  type CommitAuthor
} from './github'
import type {JaenPageNode, JaenSiteState, JaenWidget} from './types'

/** The committer of the publish commit. The author is the editor. */
export const COMMITTER: CommitAuthor = {
  name: 'jaen-agent',
  email: 'noreply.snek.at@gmail.com'
}

/** `{pages, site, widgets}`, the payload a migration's `data` carries. */
export interface DraftData {
  pages: JaenPageNode[]
  site: JaenSiteState
  widgets: JaenWidget[]
}

// --------------------------------------------------------------------------
// The migration
// --------------------------------------------------------------------------

export interface Migration {
  message: string
  createdAt: string
  data: DraftData
}

/**
 * The migration, in the shape jaen has always used.
 *
 * `{message, createdAt, data}` and nothing beside it. In particular no
 * `authors`: the build downloads every gateway file the site's data names,
 * patch payloads included, into `public/osg/<id>.<ext>`, so a published site
 * serves its own patches to anybody, and an `authors` map names a person and
 * their identity-server id per field. The authorship of a draft belongs in
 * the draft store, which holds it per field, and never in a file the build
 * republishes. See draft-state.md, "Two things this transition got wrong
 * before it got them right".
 */
export const buildMigration = (
  draft: DraftData,
  message: string,
  at: string
): Migration => ({
  message,
  createdAt: at,
  data: {
    pages: draft.pages ?? [],
    site: draft.site ?? {siteMetadata: {}},
    widgets: draft.widgets ?? []
  }
})

/** Pretty printed like every other patch of these repositories. */
export const serialiseMigration = (migration: Migration): string =>
  JSON.stringify(migration, null, 2)

/**
 * `patches.txt` with one line appended, and nothing else touched.
 *
 * Appending and never rewriting is the whole rule of this file: the chain is
 * replayed in order, every earlier line is somebody's published content, and
 * a publish that reordered or dropped one would rewrite history rather than
 * add to it. `withHeadLines` in ./document moves lines about, which is what
 * the head patches needed and what a migration must never have.
 *
 * Idempotent on the same URL, because a retry after a commit that did land
 * must not name the file twice.
 */
export const appendPatchLine = (
  current: string,
  url: string
): {text: string; changed: boolean} => {
  const lines = current.split('\n')

  while (lines.length && lines[lines.length - 1]!.trim() === '') lines.pop()

  if (lines.length && lines[lines.length - 1]!.trim() === url) {
    return {text: current, changed: false}
  }

  return {text: `${[...lines, url].join('\n')}\n`, changed: true}
}

// --------------------------------------------------------------------------
// The publish
// --------------------------------------------------------------------------

export interface PublishOutcome {
  /** A migration was written and its line committed. */
  published: boolean
  /** The revision this publish took. Null when nothing was published. */
  revision: number | null
  publishedRevision: number | null
  migrationUrl: string | null
  migrationBytes: number | null
  commitSha: string | null
  commitUrl: string | null
  publishedAt: string | null
  /** A build was dispatched. */
  queued: boolean
  workflow: string | null
  runUrl: string | null
  /** Why not, whenever `published` or `queued` is false. */
  reason: string | null
}

const MAX_ATTEMPTS = 3

/**
 * A publish's default message, when the editor gives none.
 *
 * It says what was published and by whom, because it is what a reader of
 * `git log` on the site repository sees first and because a migration's
 * message is shown in the CMS's publish list.
 */
const defaultMessage = (draft: DraftData, editorName: string): string =>
  `Publish ${draft.pages?.length ?? 0} pages, by ${editorName}`

export const publish = async (
  store: DraftStore,
  siteKey: string,
  entry: SiteEntry,
  input: {
    editor: CommitAuthor & {sub: string}
    message?: string | null
  }
): Promise<PublishOutcome> => {
  const branch = siteBranch(entry)

  // The whole draft, and then the object's own reading of what is published.
  // `read` at the snapshot's own revision answers `changed: false` with no
  // delta, which is the cheapest question the object takes, and it is the one
  // answer that carries `publishedRevision`.
  const snapshot = await store.snapshot(siteKey)
  const state = await store.read(siteKey, snapshot.revision)
  const publishedRevision = state.publishedRevision || 0

  const draft: DraftData = {
    pages: snapshot.data?.pages ?? [],
    site: snapshot.data?.site ?? {siteMetadata: {}},
    widgets: snapshot.data?.widgets ?? []
  }

  const build = async (
    outcome: Omit<PublishOutcome, 'queued' | 'workflow' | 'runUrl'> & {
      reason: string | null
    }
  ): Promise<PublishOutcome> => {
    const workflow = entry.publishWorkflow

    if (!workflow) {
      return {
        ...outcome,
        queued: false,
        workflow: null,
        runUrl: null,
        reason:
          outcome.reason ??
          'This site names no publish workflow, so the build is run by the ' +
            'operator. The migration is in the chain and the next build takes it.'
      }
    }

    const dispatched = await dispatchWorkflow(entry, workflow, branch)

    if (!dispatched.ok) {
      return {
        ...outcome,
        queued: false,
        workflow,
        runUrl: null,
        reason: `GitHub answered ${dispatched.status}: ${
          dispatched.reason ?? ''
        }`.trim()
      }
    }

    return {
      ...outcome,
      queued: true,
      workflow,
      runUrl: (await latestRunUrl(entry, workflow)) ?? null,
      reason: outcome.reason
    }
  }

  const nothing = (reason: string) =>
    build({
      published: false,
      revision: snapshot.revision,
      publishedRevision,
      migrationUrl: null,
      migrationBytes: null,
      commitSha: null,
      commitUrl: null,
      publishedAt: null,
      reason
    })

  // Nothing has changed since the last publish. A migration would be a file, a
  // line and a commit saying what the chain already says, which is exactly the
  // file and commit explosion this design was written to stop. The build is
  // still dispatched, because "publish" with nothing to publish is a person
  // asking for the site to be rebuilt.
  if (publishedRevision > 0 && publishedRevision >= snapshot.revision) {
    return await nothing('Everything in the draft is already published.')
  }

  const empty =
    draft.pages.length === 0 &&
    draft.widgets.length === 0 &&
    Object.keys(draft.site?.siteMetadata ?? {}).length === 0

  if (empty) {
    return await nothing(
      'The draft is empty, so there is nothing to publish. An empty ' +
        'migration would be a line in the chain that says nothing.'
    )
  }

  const at = new Date().toISOString()
  const migration = buildMigration(
    draft,
    (input.message ?? '').trim() || defaultMessage(draft, input.editor.name),
    at
  )
  const payload = serialiseMigration(migration)

  const uploaded = await uploadMigration(
    entry,
    payload,
    `jaen-migration-${at.slice(0, 10)}.json`
  )

  // Before the line exists, not after it.
  await readBackMigration(entry, uploaded.fileId, payload)

  const message =
    `jaen: publish ${migration.message}\n\n` +
    `Migration: ${uploaded.url}\n` +
    `Revision: ${snapshot.revision}\n` +
    `Published by: ${input.editor.name} <${input.editor.email}>`

  const path = sitePath(entry, PATCHES_PATH)

  let written: {commitSha: string; commitUrl: string} | null = null
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const file = await readFile(entry, path, branch)
    const {text, changed} = appendPatchLine(file?.text ?? '', uploaded.url)

    if (!changed) {
      // The line is already the last one, which is a retry of a commit that
      // did land. Nothing more to write.
      written = {commitSha: '', commitUrl: ''}
      break
    }

    try {
      const result = await writeFile(entry, {
        path,
        branch,
        text,
        sha: file?.sha ?? null,
        message,
        author: {name: input.editor.name, email: input.editor.email},
        committer: COMMITTER
      })

      written = {commitSha: result.commitSha, commitUrl: result.commitUrl}
      break
    } catch (error) {
      // Somebody else appended between the read and the write. The file is
      // read again and this URL appended after theirs, which is what an
      // append-only chain means: two publishes are two lines in the order
      // they landed and never one overwriting the other.
      if (!(error instanceof ConflictError)) throw error

      lastError = error
    }
  }

  if (!written) {
    throw new Error(
      `jaen-agent: ${path} of ${siteKey} changed under three consecutive ` +
        `publishes. The migration is on the gateway at ${uploaded.url} and ` +
        `nothing names it, so the site is unchanged. ` +
        `(${(lastError as Error)?.message ?? 'conflict'})`
    )
  }

  // Last, and deliberately after the commit: a failure here understates what
  // is live and never overstates it.
  const meta = await store.markPublished(siteKey, snapshot.revision)

  return await build({
    published: true,
    revision: snapshot.revision,
    publishedRevision: meta?.publishedRevision ?? snapshot.revision,
    migrationUrl: uploaded.url,
    migrationBytes: uploaded.bytes,
    commitSha: written.commitSha || null,
    commitUrl: written.commitUrl || null,
    publishedAt: at,
    reason: null
  })
}
