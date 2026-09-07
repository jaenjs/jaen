/**
 * Reading the head patch, and writing it back as a commit.
 *
 * The repository is the store. Every read comes from the branch HEAD through
 * the GitHub API, every write is a commit in the editor's name, and the only
 * state the agent keeps of its own is a thirty second read cache and a
 * fifteen second in-flight lock, both in KV, neither a store of record.
 *
 * The rule for a stale save is that it is rebased and never rejected: the
 * changes are applied onto the document read under the lock, which is the
 * rebase, and the answer names every field whose remote value it replaced.
 */
import {
  applyChanges,
  type FieldOverwrite,
  type JaenChangeInput
} from './apply-change'
import {
  LIVE_PATH,
  PATCHES_PATH,
  emptyPatch,
  fromDraft,
  parsePatch,
  serialisePatch,
  toDraft,
  withLiveLine,
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
import type {FieldAuthors} from './types'

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
  blobSha: string | null
  patch: HeadPatch
  readAt: string
}

interface CachedRead extends ReadState {
  /** The instant past which this entry is not used, see KV_MIN_TTL_SECONDS. */
  goodUntil: number
}

/**
 * The current head patch.
 *
 * `fresh` skips the KV cache, which every write does: a save that applied
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
    const hit = await kv.get(cacheKey, 'json')

    const cached = hit as CachedRead | null

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
  const file = await readFile(entry, sitePath(entry, LIVE_PATH), head)

  const {patch} = file ? parsePatch(file.text) : {patch: emptyPatch()}

  const state: ReadState = {
    head,
    blobSha: file?.sha ?? null,
    patch,
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

  try {
    let lastError: unknown

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const state = await readHead(siteKey, entry, {fresh: true})

      const rebased = Boolean(input.baseSha) && input.baseSha !== state.head

      const draft = toDraft(state.patch)
      const authors: FieldAuthors = {...(state.patch.authors ?? {})}

      const result = applyChanges(
        draft,
        input.changes,
        authors,
        {sub: input.author.sub, name: input.author.name},
        {rebased}
      )

      const message =
        `jaen: ${input.author.name} ${result.summary}` +
        (rebased ? '\n\nRebased on the current head.' : '')

      const patch = fromDraft(draft, authors, message.split('\n')[0]!)

      try {
        const written = await writeFile(entry, {
          path: sitePath(entry, LIVE_PATH),
          branch,
          text: serialisePatch(patch),
          sha: state.blobSha,
          message,
          author: {name: input.author.name, email: input.author.email},
          committer: COMMITTER
        })

        // `patches.txt` is touched only when the head patch is not in it yet,
        // once per site, right after the first save. A second commit rather
        // than the same one, because the contents API writes one file.
        await ensureLiveLine(entry, branch, input.author)

        await dropCache(siteKey, entry)

        return {
          headSha: written.commitSha,
          blobSha: written.blobSha,
          commitSha: written.commitSha,
          commitUrl: written.commitUrl,
          savedAt: new Date().toISOString(),
          rebased,
          overwrote: result.overwrote,
          authors
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

/** The head patch has to be the last line of patches.txt or it is not the head. */
const ensureLiveLine = async (
  entry: SiteEntry,
  branch: string,
  author: CommitAuthor
): Promise<void> => {
  const path = sitePath(entry, PATCHES_PATH)
  const file = await readFile(entry, path, branch)
  const {text, changed} = withLiveLine(file?.text ?? '')

  if (!changed) return

  await writeFile(entry, {
    path,
    branch,
    text,
    sha: file?.sha ?? null,
    message: 'jaen: record the head patch in patches.txt',
    author: {name: author.name, email: author.email},
    committer: COMMITTER
  })
}
