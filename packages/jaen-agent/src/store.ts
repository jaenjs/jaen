/**
 * Reading the head files, and writing back the one a save touched.
 *
 * The repository is the store. Every read comes from the branch HEAD through
 * the GitHub API, every write is a commit in the editor's name, and the only
 * state the agent keeps of its own is a thirty second read cache and a
 * fifteen second in-flight lock, both in KV, neither a store of record.
 *
 * Two files and not one, see ./document: `jaen-data/live.json` carries the
 * pages, the site metadata and the widgets, `jaen-data/live-media.json`
 * carries the media catalogue. A save reads and writes only the file its
 * changes belong to, so a text change no longer PUTs the 80 KB of media nodes
 * it does not touch and a picture no longer PUTs the pages.
 *
 * The rule for a stale save is unchanged: it is rebased and never rejected.
 * The changes are applied onto the file read under the lock, which is the
 * rebase, and the answer names every field whose remote value it replaced.
 */
import {
  applyChanges,
  type FieldOverwrite,
  type JaenChangeInput
} from './apply-change'
import {
  emptyMediaPatch,
  emptyPatch,
  fromDraft,
  HEAD_LINES,
  isMediaChange,
  LIVE_LINE,
  LIVE_PATH,
  MEDIA_LINE,
  MEDIA_PATH,
  mergePatches,
  parsePatch,
  PATCHES_PATH,
  serialisePatch,
  splitPatch,
  toDraft,
  withHeadLines,
  type HeadPatch
} from './document'
import {cache, siteBranch, sitePath, type SiteEntry} from './env'
import {
  ConflictError,
  headSha,
  readFile,
  writeFile,
  type CommitAuthor
} from './github'
import type {FieldAuthors, JaenDraft} from './types'

/** The committer of every commit. The author is the editor. */
export const COMMITTER: CommitAuthor = {
  name: 'jaen-agent',
  email: 'noreply.snek.at@gmail.com'
}

/**
 * Cloudflare KV refuses an expirationTtl below sixty seconds ("Invalid
 * expiration_ttl of 15. Expiration TTL must be at least 60."), and the design
 * wants thirty for the cache and fifteen for the lock. So the key lives for
 * KV's minute and carries its own deadline inside, which is what both are
 * read against. KV only ever holds the value longer than it is honoured, and
 * a stale one is ignored rather than trusted.
 */
const KV_MIN_TTL_SECONDS = 60
const CACHE_TTL_MS = 30_000
const LOCK_TTL_MS = 15_000
const LOCK_WAIT_MS = 3_000
const MAX_ATTEMPTS = 3

export interface ReadState {
  head: string
  /** `jaen-data/live.json` at that commit, which is what the API answers. */
  blobSha: string | null
  /** The two files put back together. */
  patch: HeadPatch
  readAt: string
}

interface CachedRead extends ReadState {
  /** The instant past which this entry is not used, see KV_MIN_TTL_SECONDS. */
  goodUntil: number
}

// --------------------------------------------------------------------------
// One file of the head
// --------------------------------------------------------------------------

interface PartRead {
  path: string
  /** Null when the file is not in the repository yet. */
  text: string | null
  blobSha: string | null
  patch: HeadPatch
}

const readPart = async (
  entry: SiteEntry,
  path: string,
  ref: string,
  fallback: () => HeadPatch
): Promise<PartRead> => {
  const file = await readFile(entry, sitePath(entry, path), ref)

  return {
    path,
    text: file?.text ?? null,
    blobSha: file?.sha ?? null,
    patch: file ? parsePatch(file.text).patch : fallback()
  }
}

/**
 * The branch head alone.
 *
 * This is what a poll costs whose `sinceSha` is still the head, which is
 * almost every poll of every open CMS: one commit lookup and no file read at
 * all, or nothing when the cache is warm. Before the split it read the whole
 * head patch to answer `changed: false` with no body.
 */
export const readHeadSha = async (
  siteKey: string,
  entry: SiteEntry
): Promise<string> => {
  const kv = cache()

  if (kv) {
    const hit = (await kv.get(
      headKey(siteKey, entry),
      'json'
    )) as CachedRead | null

    if (hit && hit.goodUntil > Date.now()) return hit.head
  }

  return headSha(entry, siteBranch(entry))
}

/**
 * The current head, both files merged.
 *
 * `fresh` skips the KV cache. Every write does, because a save that applied
 * changes onto a thirty second old document would lose whatever landed in
 * between, and the whole point of the lock is that it does not.
 */
export const readHead = async (
  siteKey: string,
  entry: SiteEntry,
  options?: {fresh?: boolean}
): Promise<ReadState> => {
  const kv = cache()
  const branch = siteBranch(entry)
  // The branch is part of the key: a site entry that is repointed at another
  // branch, which is what the tests do, must not read the old branch's head
  // out of a cache that outlives the change. dropCache builds the same key.
  const cacheKey = headKey(siteKey, entry)

  if (!options?.fresh && kv) {
    const cached = (await kv.get(cacheKey, 'json')) as CachedRead | null

    if (cached && cached.goodUntil > Date.now()) {
      return {
        head: cached.head,
        blobSha: cached.blobSha,
        patch: cached.patch,
        readAt: cached.readAt
      }
    }
  }

  const head = await headSha(entry, branch)

  const [main, media] = await Promise.all([
    readPart(entry, LIVE_PATH, head, emptyPatch),
    readPart(entry, MEDIA_PATH, head, emptyMediaPatch)
  ])

  // A site that saved before the split still carries the catalogue inside
  // live.json. Splitting it here rather than only on the next save is what
  // lets the CMS read one document either way.
  const split = splitPatch(main.patch)

  const state: ReadState = {
    head,
    blobSha: main.blobSha,
    patch: mergePatches(
      split.main,
      media.text === null && split.carried ? split.media : media.patch
    ),
    readAt: new Date().toISOString()
  }

  if (kv) {
    // A cold or lost cache is a slower read and never a lost change, because
    // every write re-reads GitHub under the lock before it applies anything.
    const cached: CachedRead = {...state, goodUntil: Date.now() + CACHE_TTL_MS}

    await kv
      .put(cacheKey, JSON.stringify(cached), {
        expirationTtl: KV_MIN_TTL_SECONDS
      })
      .catch(() => undefined)
  }

  return state
}

// --------------------------------------------------------------------------
// The lock
// --------------------------------------------------------------------------

/**
 * Two saves of one site serialise instead of racing the contents API.
 *
 * KV has no compare-and-set, so this is a read, a write and a read back with
 * a token of our own: it narrows the window rather than closing it. What
 * closes it is the blob sha on the PUT, which makes GitHub refuse a write
 * whose base moved, and the retry loop below. The lock exists so that two
 * saves normally cost one round trip each rather than three.
 */
const acquireLock = async (siteKey: string): Promise<string | null> => {
  const kv = cache()

  if (!kv) return null

  const key = `lock:${siteKey}`
  const mine = crypto.randomUUID()
  const until = Date.now() + LOCK_WAIT_MS

  for (;;) {
    const held = parseLock(await kv.get(key))

    if (!held || held.until <= Date.now()) {
      await kv.put(
        key,
        JSON.stringify({holder: mine, until: Date.now() + LOCK_TTL_MS}),
        {
          expirationTtl: KV_MIN_TTL_SECONDS
        }
      )

      const readBack = parseLock(await kv.get(key))

      if (readBack?.holder === mine) return mine
    }

    if (Date.now() >= until) {
      // Waited long enough. Going ahead is safe: the PUT carries the blob sha
      // and the loop retries a conflict.
      return null
    }

    await new Promise(resolve => setTimeout(resolve, 120))
  }
}

const parseLock = (
  raw: string | null
): {holder: string; until: number} | null => {
  if (!raw) return null

  try {
    return JSON.parse(raw) as {holder: string; until: number}
  } catch {
    return null
  }
}

const releaseLock = async (siteKey: string, mine: string | null) => {
  const kv = cache()

  if (!kv || !mine) return

  const key = `lock:${siteKey}`

  if (parseLock(await kv.get(key))?.holder === mine) {
    await kv.delete(key).catch(() => undefined)
  }
}

/** The same key readHead writes, branch included, or nothing is dropped. */
const dropCache = async (siteKey: string, entry: SiteEntry) => {
  const kv = cache()

  if (kv) {
    await kv.delete(headKey(siteKey, entry)).catch(() => undefined)
  }
}

const headKey = (siteKey: string, entry: SiteEntry): string =>
  `head:${siteKey}:${siteBranch(entry)}`

// --------------------------------------------------------------------------
// The save
// --------------------------------------------------------------------------

export interface SaveOutcome {
  headSha: string
  blobSha: string
  commitSha: string
  commitUrl: string
  savedAt: string
  rebased: boolean
  overwrote: FieldOverwrite[]
  authors: FieldAuthors
  /** The head files this save actually wrote. Empty is impossible. */
  wrote: string[]
}

interface Pending {
  part: PartRead
  draft: JaenDraft
  authors: FieldAuthors
}

export const save = async (
  siteKey: string,
  entry: SiteEntry,
  input: {
    changes: JaenChangeInput[]
    baseSha?: string | null
    author: CommitAuthor & {sub: string}
  }
): Promise<SaveOutcome> => {
  const branch = siteBranch(entry)
  const lock = await acquireLock(siteKey)

  const mediaChanges = input.changes.filter(isMediaChange)
  const mainChanges = input.changes.filter(change => !isMediaChange(change))

  try {
    let lastError: unknown

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Only the file the changes belong to is read. A picture never opens
      // the pages and a text change never opens the catalogue, which is one
      // round trip and the whole catalogue's parsing each way.
      //
      // The file is read at the branch and not at a pinned commit, so the
      // head lookup runs beside it rather than in front of it. The branch is
      // at least as fresh as the sha, and what makes the write safe is the
      // blob sha on the PUT, not the ref the read named. That turns the two
      // round trips a save opened with into one.
      const [head, firstRead] = await Promise.all([
        headSha(entry, branch),
        mediaChanges.length
          ? readPart(entry, MEDIA_PATH, branch, emptyMediaPatch)
          : readPart(entry, LIVE_PATH, branch, emptyPatch)
      ])

      const rebased = Boolean(input.baseSha) && input.baseSha !== head

      let media = mediaChanges.length ? firstRead : null

      const needMain = mainChanges.length > 0 || media?.text === null

      let main = mediaChanges.length
        ? needMain
          ? await readPart(entry, LIVE_PATH, branch, emptyPatch)
          : null
        : firstRead

      let mainPatch = main?.patch
      let carried = false

      if (main) {
        const split = splitPatch(main.patch)

        mainPatch = split.main
        carried = split.carried

        // The site saved before the split existed, so the catalogue is still
        // inside live.json. It moves out here, once, in the same save.
        if (carried) {
          if (!media) {
            media = await readPart(entry, MEDIA_PATH, branch, emptyMediaPatch)
          }

          if (media.text === null) media.patch = split.media
        }
      }

      const pending: Array<Pending & {kind: 'main' | 'media'}> = []
      const overwrote: FieldOverwrite[] = []
      const summaries: string[] = []
      const authors: FieldAuthors = {}

      if (main && mainPatch) {
        const draft = toDraft(mainPatch)
        const mainAuthors: FieldAuthors = {...(mainPatch.authors ?? {})}

        if (mainChanges.length) {
          const result = applyChanges(
            draft,
            mainChanges,
            mainAuthors,
            {sub: input.author.sub, name: input.author.name},
            {rebased}
          )

          overwrote.push(...result.overwrote)
          summaries.push(result.summary)
        }

        // Written when the batch touched it, and also when the catalogue had
        // to be lifted out of it, which changes the file without any change
        // of the caller's.
        if (mainChanges.length || carried) {
          pending.push({kind: 'main', part: main, draft, authors: mainAuthors})
        }

        Object.assign(authors, mainAuthors)
      }

      if (media) {
        const draft = toDraft(media.patch)
        const mediaAuthors: FieldAuthors = {...(media.patch.authors ?? {})}

        if (mediaChanges.length) {
          const result = applyChanges(
            draft,
            mediaChanges,
            mediaAuthors,
            {sub: input.author.sub, name: input.author.name},
            {rebased}
          )

          overwrote.push(...result.overwrote)
          summaries.push(result.summary)
        }

        if (mediaChanges.length || (carried && media.text === null)) {
          pending.push({
            kind: 'media',
            part: media,
            draft,
            authors: mediaAuthors
          })
        }

        Object.assign(authors, mediaAuthors)
      }

      const message =
        `jaen: ${input.author.name} ${summaries.join(', ') || 'saved'}` +
        (rebased ? '\n\nRebased on the current head.' : '')

      const first = message.split('\n')[0]!

      try {
        let written: {
          commitSha: string
          commitUrl: string
          blobSha: string
        } | null = null
        let mainBlob = main?.blobSha ?? ''
        const wrote: string[] = []

        for (const entryToWrite of pending) {
          const patch = fromDraft(
            entryToWrite.draft,
            entryToWrite.authors,
            first
          )

          // The catalogue file carries no site metadata and no widgets: it is
          // one page stub with one field, and writing empty containers into
          // it would put them into the build's merge for no reason.
          if (entryToWrite.kind === 'media') {
            patch.data.site = {}
            patch.data.widgets = []
          }

          const result = await writeFile(entry, {
            path: sitePath(entry, entryToWrite.part.path),
            branch,
            text: serialisePatch(patch),
            sha: entryToWrite.part.blobSha,
            message,
            author: {name: input.author.name, email: input.author.email},
            committer: COMMITTER
          })

          written = result
          wrote.push(entryToWrite.part.path)

          if (entryToWrite.kind === 'main') mainBlob = result.blobSha
        }

        if (!written) {
          throw new Error('jaen-agent: a save that wrote no file at all')
        }

        // `patches.txt` is touched only when the two head files are not
        // already its last two lines, in that order: once per site after the
        // first save, and once more when the catalogue is split off.
        await ensureHeadLines(siteKey, entry, branch, input.author, {
          media: wrote.includes(MEDIA_PATH)
        })

        await dropCache(siteKey, entry)

        return {
          headSha: written.commitSha,
          blobSha: mainBlob,
          commitSha: written.commitSha,
          commitUrl: written.commitUrl,
          savedAt: new Date().toISOString(),
          rebased,
          overwrote,
          authors,
          wrote
        }
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error

        lastError = error
        await dropCache(siteKey, entry)
      }
    }

    throw new Error(
      `jaen-agent: ${siteKey} changed under three consecutive saves. The changes ` +
        `were not committed and the client keeps them in its queue. ` +
        `(${(lastError as Error)?.message ?? 'conflict'})`
    )
  } finally {
    await releaseLock(siteKey, lock)
  }
}

/**
 * The head files have to be the last lines of patches.txt, in this order, or
 * they are not the head.
 *
 * `live-media.json` is listed only once it exists, because the build reads a
 * local patch line as a file and panics on one that is not there. So the
 * wanted tail is `live.json` alone until the catalogue file has been written,
 * and both from then on, which the file itself remembers: a line already in
 * patches.txt names a file already in the repository.
 *
 * The answer is remembered in KV, because reading patches.txt on every save
 * was one GitHub round trip out of four for a file that changes twice in the
 * life of a site. The memory is not a store of record and losing it costs one
 * read: it says nothing but "the lines were in order the last time somebody
 * looked", it is keyed by the tail it saw, and it lapses after an hour so
 * that a maintainer who edits patches.txt by hand is noticed without anybody
 * having to tell the agent.
 */
const PATCHES_MEMORY_TTL_SECONDS = 3600

const ensureHeadLines = async (
  siteKey: string,
  entry: SiteEntry,
  branch: string,
  author: CommitAuthor,
  options: {media: boolean}
): Promise<void> => {
  const kv = cache()
  const memory = `patches:${siteKey}:${branch}`

  if (kv) {
    const seen = await kv.get(memory).catch(() => null)

    // `both` covers every save, `live` covers one that wrote no catalogue.
    if (seen === 'both' || (seen === 'live' && !options.media)) return
  }

  const path = sitePath(entry, PATCHES_PATH)
  const file = await readFile(entry, path, branch)
  const current = file?.text ?? ''

  const listed = current
    .split('\n')
    .map(line => line.trim())
    .includes(MEDIA_LINE)

  const both = options.media || listed

  const {text, changed} = withHeadLines(
    current,
    both ? HEAD_LINES : [LIVE_LINE]
  )

  if (changed) {
    await writeFile(entry, {
      path,
      branch,
      text,
      sha: file?.sha ?? null,
      message: 'jaen: record the head patches in patches.txt',
      author: {name: author.name, email: author.email},
      committer: COMMITTER
    })
  }

  await kv
    ?.put(memory, both ? 'both' : 'live', {
      expirationTtl: PATCHES_MEMORY_TTL_SECONDS
    })
    .catch(() => undefined)
}
