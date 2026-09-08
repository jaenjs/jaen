/**
 * The head patch, `jaen-data/live.json`, and the media catalogue beside it,
 * `jaen-data/live-media.json`.
 *
 * The repository is the store, so the agent owns two files per site and
 * rewrites the one a save touched. Their shape is the patch shape the build
 * already reads, `{createdAt, message, data: {pages, site, widgets}}`, and
 * they are the last two lines of `jaen-data/patches.txt`, live.json first and
 * live-media.json after it, so together they win the deepmerge and the
 * repository's HEAD is at all times a buildable statement of the current
 * content. See docs/architecture/draft-state.md, "The repository as the
 * store: one head patch".
 *
 * Why two files and not one. `media_nodes` is a jaen field like any other,
 * but it is the one field that holds a catalogue: 140 nodes and 80 KB of the
 * 120 KB booklimo.at's head patch weighed on 2026-09-08, two thirds of every
 * PUT of every text change. Splitting it off is not a new data path, it is
 * one more line in patches.txt: a text save now writes 40 KB without the
 * catalogue, and a picture writes the catalogue without the pages.
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
export const MEDIA_PATH = 'jaen-data/live-media.json'
export const PATCHES_PATH = 'jaen-data/patches.txt'

/** The lines `patches.txt` carries, in this order and last in the file. */
export const LIVE_LINE = 'live.json'
export const MEDIA_LINE = 'live-media.json'
export const HEAD_LINES = [LIVE_LINE, MEDIA_LINE]

/**
 * The one field that is a catalogue rather than a value.
 *
 * `containers/media.tsx` reads and writes `useField('media_nodes',
 * 'IMA:MEDIA_NODES')`, so every picture in the library is one key of one
 * field of one page. That is why it needs no data path of its own and why it
 * does need a file of its own.
 */
export const MEDIA_FIELD_TYPE = 'IMA:MEDIA_NODES'

/** A change that writes the catalogue, and so belongs in the media file. */
export const isMediaChange = (change: {fieldType?: string}): boolean =>
  change.fieldType === MEDIA_FIELD_TYPE

/** An authors key that names the catalogue field, see ./apply-change fieldKey. */
export const isMediaAuthorKey = (key: string): boolean =>
  key.includes(`/${MEDIA_FIELD_TYPE}/`)

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
 * `patches.txt` with the two head files as its last two lines, live.json
 * first and live-media.json after it.
 *
 * Touched only when they are not already in that order at the end, so once
 * per site on the first save and once more when the catalogue is split off.
 * An existing line anywhere else in the file is moved to the end, because a
 * head patch that does not win the merge is silently not the head, and the
 * order between the two matters as much: the catalogue is written without the
 * pages and the pages without the catalogue, so whichever is last only has to
 * be last among the two, not to carry the other.
 */
export const withHeadLines = (
  current: string,
  lines = HEAD_LINES
): {text: string; changed: boolean} => {
  const wanted = lines.filter(Boolean)
  const existing = current.split('\n')
  const kept: string[] = []

  for (const line of existing) {
    if (wanted.includes(line.trim())) continue
    kept.push(line)
  }

  while (kept.length && kept[kept.length - 1]!.trim() === '') kept.pop()

  const tail = existing
    .map(line => line.trim())
    .filter(Boolean)
    .slice(-wanted.length)

  if (tail.length === wanted.length && tail.every((l, i) => l === wanted[i])) {
    return {text: current, changed: false}
  }

  return {text: `${[...kept, ...wanted].join('\n')}\n`, changed: true}
}

// --------------------------------------------------------------------------
// The split
// --------------------------------------------------------------------------

const clonePage = (page: JaenPageNode): JaenPageNode => ({
  ...page,
  jaenFields: page.jaenFields ? {...page.jaenFields} : page.jaenFields
})

/**
 * A patch taken apart into the pages and the catalogue.
 *
 * `carried` is true when the pages file still held the catalogue, which is
 * the state of every site that saved before the split existed. The caller
 * writes both files once in that case and never again: from then on a text
 * save reads and writes the pages alone and a picture the catalogue alone.
 */
export const splitPatch = (
  patch: HeadPatch
): {main: HeadPatch; media: HeadPatch; carried: boolean} => {
  const mainPages: JaenPageNode[] = []
  const mediaPages: JaenPageNode[] = []
  let carried = false

  for (const page of patch.data?.pages ?? []) {
    if (!page || typeof page !== 'object') continue

    const fields = page.jaenFields

    if (!fields || !(MEDIA_FIELD_TYPE in fields)) {
      mainPages.push(page)
      continue
    }

    carried = true

    const stripped = clonePage(page)
    delete stripped.jaenFields![MEDIA_FIELD_TYPE]
    mainPages.push(stripped)

    // The catalogue file carries a page stub and nothing else: an id and the
    // one field. The build merges patches by page id, so the stub lands on
    // the page the pages file already described.
    mediaPages.push({
      id: page.id,
      jaenFields: {[MEDIA_FIELD_TYPE]: fields[MEDIA_FIELD_TYPE]!}
    })
  }

  const mainAuthors: FieldAuthors = {}
  const mediaAuthors: FieldAuthors = {}

  for (const [key, author] of Object.entries(patch.authors ?? {})) {
    ;(isMediaAuthorKey(key) ? mediaAuthors : mainAuthors)[key] = author
  }

  return {
    main: {
      createdAt: patch.createdAt,
      message: patch.message,
      data: {
        pages: mainPages,
        site: patch.data?.site ?? {siteMetadata: {}},
        widgets: patch.data?.widgets ?? []
      },
      authors: mainAuthors
    },
    media: {
      createdAt: patch.createdAt,
      message: patch.message,
      data: {pages: mediaPages, site: {}, widgets: []},
      authors: mediaAuthors
    },
    carried
  }
}

/**
 * The two files put back together, which is what a `draft` answer is.
 *
 * The catalogue wins its own field, because it is the file the picture saves
 * write; everything else comes from the pages file. Merging at field level
 * and not key level is what makes a deleted media node stay deleted in the
 * CMS.
 */
export const mergePatches = (main: HeadPatch, media: HeadPatch): HeadPatch => {
  const pages: Record<string, JaenPageNode> = {}
  const order: string[] = []

  const take = (page: JaenPageNode) => {
    const id = page.id

    if (typeof id !== 'string' || !id) return

    if (!pages[id]) order.push(id)

    const existing = pages[id]

    pages[id] = existing
      ? {
          ...existing,
          ...page,
          jaenFields: {
            ...(existing.jaenFields ?? {}),
            ...(page.jaenFields ?? {})
          }
        }
      : page
  }

  for (const page of main.data?.pages ?? []) take(page)
  for (const page of media.data?.pages ?? []) take(page)

  return {
    createdAt: main.createdAt,
    message: main.message,
    data: {
      pages: order.map(id => pages[id]!),
      site: main.data?.site ?? {siteMetadata: {}},
      widgets: main.data?.widgets ?? []
    },
    authors: {...(main.authors ?? {}), ...(media.authors ?? {})}
  }
}

/** The catalogue file as it looks before anything has been saved into it. */
export const emptyMediaPatch = (): HeadPatch => ({
  createdAt: new Date().toISOString(),
  message: 'jaen: the media catalogue',
  data: {pages: [], site: {}, widgets: []},
  authors: {}
})
