/**
 * The head patch, `jaen-data/live.json`.
 *
 * The repository is the store, so the agent owns exactly one file per site
 * and rewrites it on every save. Its shape is the patch shape the build
 * already reads, `{createdAt, message, data: {pages, site, widgets}}`, and it
 * is the last line of `jaen-data/patches.txt`, so it wins the deepmerge and
 * the repository's HEAD is at all times a buildable statement of the current
 * content. See docs/architecture/draft-state.md, "The repository as the
 * store: one head patch".
 *
 * `authors` is the one key the build does not read.
 * `gatsby-source-jaen/src/source-nodes/jaen-data.ts` destructures
 * `{createdAt, message, data}` off each patch and ignores everything else, so
 * the field authorship the CMS shows rides along in the same file rather than
 * in a store of its own.
 */
import type {FieldAuthors, JaenDraft, JaenPageNode} from './types'

/** Relative to the repository root, or to the site's cwd inside it. */
export const LIVE_PATH = 'jaen-data/live.json'
export const PATCHES_PATH = 'jaen-data/patches.txt'

/** The line `patches.txt` carries for the head patch. */
export const LIVE_LINE = 'live.json'

export interface HeadPatch {
  createdAt: string
  message: string
  data: {
    pages: JaenPageNode[]
    site: {siteMetadata?: Record<string, unknown>}
    widgets: unknown[]
  }
  authors?: FieldAuthors
}

export const emptyPatch = (): HeadPatch => ({
  createdAt: new Date().toISOString(),
  message: 'jaen: the head patch',
  data: {pages: [], site: {siteMetadata: {}}, widgets: []},
  authors: {}
})

/**
 * The patch as the applier wants it: pages keyed by id, which is the shape
 * the redux `page` slice has. `publishDraft` in the CMS does the same in the
 * other direction, `Object.entries(nodes).map(([id, page]) => ({id, ...page}))`.
 */
export const toDraft = (patch: HeadPatch): JaenDraft => {
  const pages: Record<string, JaenPageNode> = {}

  for (const page of patch.data?.pages ?? []) {
    if (!page || typeof page !== 'object') continue

    const id = (page as JaenPageNode).id

    if (typeof id !== 'string' || !id) continue

    pages[id] = page as JaenPageNode
  }

  return {
    pages,
    site: patch.data?.site ?? {siteMetadata: {}},
    widgets: (patch.data?.widgets ?? []) as JaenDraft['widgets']
  }
}

export const fromDraft = (
  draft: JaenDraft,
  authors: FieldAuthors,
  message: string
): HeadPatch => ({
  createdAt: new Date().toISOString(),
  message,
  data: {
    pages: Object.entries(draft.pages).map(([id, page]) => ({...page, id})),
    site: draft.site ?? {siteMetadata: {}},
    widgets: draft.widgets ?? []
  },
  authors
})

/**
 * Parses what the repository holds, tolerating a file that is not a patch.
 *
 * A malformed head file is not a reason to lose a save: the agent starts from
 * an empty patch and the next commit makes the file well formed again. It is
 * a reason to say so, which the caller does in the commit message.
 */
export const parsePatch = (
  text: string
): {patch: HeadPatch; malformed: boolean} => {
  try {
    const parsed = JSON.parse(text) as HeadPatch

    if (!parsed || typeof parsed !== 'object' || !parsed.data) {
      return {patch: emptyPatch(), malformed: true}
    }

    return {
      patch: {
        createdAt: parsed.createdAt ?? new Date().toISOString(),
        message: parsed.message ?? '',
        data: {
          pages: Array.isArray(parsed.data.pages) ? parsed.data.pages : [],
          site: parsed.data.site ?? {siteMetadata: {}},
          widgets: Array.isArray(parsed.data.widgets) ? parsed.data.widgets : []
        },
        authors: parsed.authors ?? {}
      },
      malformed: false
    }
  } catch {
    return {patch: emptyPatch(), malformed: true}
  }
}

/** Two spaces, a trailing newline, so `git diff` on a save is readable. */
export const serialisePatch = (patch: HeadPatch): string =>
  `${JSON.stringify(patch, null, 2)}\n`

/**
 * `patches.txt` with the head patch as its last line.
 *
 * Touched only when the line is not there yet, once per site, in the same
 * commit as the first save. An existing line anywhere else in the file is
 * moved to the end, because a head patch that does not win the merge is
 * silently not the head.
 */
export const withLiveLine = (
  current: string
): {text: string; changed: boolean} => {
  const lines = current.split('\n')
  const kept: string[] = []
  let found = false

  for (const line of lines) {
    if (line.trim() === LIVE_LINE) {
      found = true
      continue
    }
    kept.push(line)
  }

  while (kept.length && kept[kept.length - 1]!.trim() === '') kept.pop()

  const isLast =
    found &&
    lines
      .filter(l => l.trim() !== '')
      .pop()
      ?.trim() === LIVE_LINE

  if (isLast) return {text: current, changed: false}

  kept.push(LIVE_LINE)

  return {text: `${kept.join('\n')}\n`, changed: true}
}
