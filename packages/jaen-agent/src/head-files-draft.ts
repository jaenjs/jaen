/**
 * The interim draft source: the two head files, read only.
 *
 * `docs/architecture/draft-state.md` puts a site's draft in a Durable Object
 * per site. Until that object lands, a site's draft is where the first build
 * of the shared draft left it, `jaen-data/live.json` and
 * `jaen-data/live-media.json`, and this reads it from there so that the
 * publish path is complete and measurable rather than waiting.
 *
 * Reading those two files is not the direction being undone. What was wrong
 * was writing every save into them as a commit; this writes nothing to any
 * repository. Turning them into one migration is exactly what
 * `scripts/head-to-migration.ts` did by hand for booklimo on 2026-09-08, and
 * this is the agent doing the same thing on demand.
 *
 * A site whose head files are gone, which is both limousine sites since that
 * transition, reads an empty draft here and `publish` says there is nothing
 * to publish rather than writing an empty migration.
 *
 * It is registered in ./index and replaced there by the object's own
 * implementation of the same interface, at which point this file goes.
 */
import {
  emptyMediaPatch,
  emptyPatch,
  LIVE_PATH,
  MEDIA_PATH,
  mergePatches,
  parsePatch,
  splitPatch
} from './document'
import {cache, siteBranch, sitePath, type SiteEntry} from './env'
import {headSha, readFile} from './github'
import type {DraftSource} from './publish'
import type {JaenWidget} from './types'

interface Mark {
  revision: number
  sha: string
  url: string
  at: string
}

const markKey = (siteKey: string, entry: SiteEntry): string =>
  `published:${siteKey}:${siteBranch(entry)}`

const readMark = async (
  siteKey: string,
  entry: SiteEntry
): Promise<Mark | null> => {
  const kv = cache()

  if (!kv) return null

  try {
    return (await kv.get(markKey(siteKey, entry), 'json')) as Mark | null
  } catch {
    return null
  }
}

/**
 * The revision of a draft that has no counter.
 *
 * The object's revision is a counter a save bumps. These two files have none,
 * so the head patch's own `createdAt` in epoch milliseconds stands in: it has
 * the one property publish needs of a revision, which is that it changes when
 * the draft changes and not otherwise. Two saves inside one millisecond would
 * share a revision, which costs a "already published" answer to the second
 * publish of the pair; it is an interim's rounding error and it is written
 * down rather than hidden.
 *
 * Zero when there is no draft at all, which is what `publish` reads as empty.
 */
const revisionOf = (...stamps: Array<string | undefined>): number => {
  let newest = 0

  for (const stamp of stamps) {
    if (!stamp) continue

    const at = Date.parse(stamp)

    if (Number.isFinite(at) && at > newest) newest = at
  }

  return newest
}

export const headFilesDraft: DraftSource = {
  snapshot: async (siteKey, entry) => {
    const branch = siteBranch(entry)
    const head = await headSha(entry, branch)

    const [live, media] = await Promise.all([
      readFile(entry, sitePath(entry, LIVE_PATH), head),
      readFile(entry, sitePath(entry, MEDIA_PATH), head)
    ])

    const livePatch = live ? parsePatch(live.text).patch : emptyPatch()
    const mediaPatch = media ? parsePatch(media.text).patch : emptyMediaPatch()

    // A site that saved before the catalogue was split off still carries it
    // inside live.json, so the reader's own split is done here too and the
    // merge below produces one payload either way.
    const split = splitPatch(livePatch)
    const merged = mergePatches(
      split.main,
      media === null && split.carried ? split.media : mediaPatch
    )

    const mark = await readMark(siteKey, entry)

    return {
      revision: revisionOf(
        live ? livePatch.createdAt : undefined,
        media ? mediaPatch.createdAt : undefined
      ),
      publishedRevision: mark?.revision ?? null,
      data: {
        pages: merged.data.pages,
        site: merged.data.site,
        widgets: merged.data.widgets as JaenWidget[]
      }
    }
  },

  markPublished: async (siteKey, entry, mark) => {
    const kv = cache()

    if (!kv) return

    // No expiry. This is the only thing the agent keeps that a reader would
    // notice the loss of, and losing it costs one wrong toolbar line
    // ("nothing published yet") and never a wrong repository.
    await kv
      .put(markKey(siteKey, entry), JSON.stringify(mark))
      .catch(() => undefined)
  }
}
