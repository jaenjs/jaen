/**
 * The shape of a jaen draft, structurally.
 *
 * `packages/jaen/src/types.ts` declares the same things, but that module
 * imports gatsby, gatsby-plugin-image, react-icons and jaen's own auth
 * context, none of which a Worker can carry and none of which a change
 * applier needs. So the four shapes the applier touches are restated here,
 * structurally compatible with jaen's own, and nothing else is.
 */

export interface JaenField {
  value?: unknown
  props?: unknown
  position?: number
}

/** `{[fieldType]: {[fieldName]: JaenField}}`, jaen's own two level map. */
export type JaenFields = Record<string, Record<string, JaenField>>

export interface JaenBlock {
  id: string
  type?: string
  jaenFields?: JaenFields | null
  jaenFiles?: unknown[]
  ptrPrev?: string | null
  ptrNext?: string | null
  sections?: JaenSection[]
  deleted?: boolean
  props?: unknown
  [key: string]: unknown
}

export interface JaenSection {
  fieldName: string
  items: JaenBlock[]
  ptrHead?: string | null
  ptrTail?: string | null
  props?: unknown
}

export interface SectionPathEntry {
  fieldName: string
  sectionId?: string
}

export type SectionPath = SectionPathEntry[]

export interface JaenPageNode {
  id?: string
  slug?: string
  jaenFields?: JaenFields | null
  sections?: JaenSection[]
  jaenPageMetadata?: Record<string, unknown>
  parentPage?: {id: string} | null
  childPages?: Array<{id: string; deleted?: boolean}>
  template?: string
  excludedFromIndex?: unknown
  childPagesOrder?: string[]
  createdAt?: string
  modifiedAt?: string
  createdBy?: string
  deleted?: boolean
  [key: string]: unknown
}

export interface JaenWidget {
  id: string
  name?: string
  data?: unknown
  createdAt?: string
  modifiedAt?: string
  [key: string]: unknown
}

export interface JaenSiteState {
  siteMetadata?: Record<string, unknown>
}

/**
 * The draft as the agent holds it while it applies changes: pages keyed by
 * id, which is the shape the redux `page` slice has. The head patch on disk
 * carries the pages as an array instead, see ./document.
 */
export interface JaenDraft {
  pages: Record<string, JaenPageNode>
  site: JaenSiteState
  widgets: JaenWidget[]
}

/** Who last wrote a field, and when. Keyed by ./apply-change fieldKey(). */
export interface FieldAuthor {
  sub: string
  name: string
  at: string
}

export type FieldAuthors = Record<string, FieldAuthor>
