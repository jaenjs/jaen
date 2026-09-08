/**
 * One dispatched redux action, named and flattened, and the code that applies
 * it to a draft.
 *
 * The client sends what it already produces and the agent needs no diffing.
 * The eight kinds are exactly the eight draft bearing actions of the `page`,
 * `site` and `widget` slices; the two slices that are not part of the draft
 * (`status`, `popup`) have none. Every branch below is the reducer of
 * `packages/jaen/src/redux/slices/*.ts` with the redux immer draft replaced by
 * a plain object, so the browser and the agent cannot disagree about what a
 * change means.
 *
 * What the agent does NOT take from the client: the author. It stamps that
 * itself out of the introspected token and ignores anything the client sends,
 * because a commit author line that a caller can choose is not an audit trail.
 */
import {v4 as uuidv4} from 'uuid'

import {insertSectionIntoTree} from './section-tree'
import type {
  FieldAuthor,
  FieldAuthors,
  JaenDraft,
  JaenPageNode,
  JaenSection,
  SectionPath
} from './types'

export type JaenChangeKind =
  | 'fieldWrite' // page.field_write
  | 'fieldMerge' // page.field_write, of a field that holds a catalogue
  | 'sectionAdd' // page.section_add
  | 'sectionRemove' // page.section_remove
  | 'sectionMove' // page.section_move
  | 'pageUpdate' // page.page_updateOrCreate
  | 'pageDelete' // page.page_markForDeletion
  | 'siteMetadata' // site.updateSiteMetadata
  | 'widgetWrite' // widget.writeData

/**
 * `value` and `props` are the JSON scalar, because a jaen field's value is
 * whatever the field type stores.
 *
 * Which slot carries what, per kind:
 *
 *   fieldWrite    pageId, fieldType, fieldName, optional section, value, props
 *   fieldMerge    the same, but value is the entries that changed and
 *                 props.removed the keys that went
 *   sectionAdd    pageId, section.path, props {between, sectionItemType}
 *   sectionRemove pageId, section.path, section.id, props {between}
 *   sectionMove   pageId, section.path, section.id, props {between, move}
 *   pageUpdate    pageId (absent creates), value = the page payload
 *   pageDelete    pageId
 *   siteMetadata  value = the metadata partial
 *   widgetWrite   value = the widget payload
 *
 * `props` carries the structural remainder of the three section actions
 * because the redux payload has fields (`between`, `move`, `sectionItemType`)
 * that no other kind has, and one JSON slot is cheaper than three arguments
 * that are null on five kinds out of eight.
 */
export interface JaenChangeInput {
  kind: JaenChangeKind
  pageId?: string
  section?: {path: SectionPath; id?: string}
  fieldType?: string
  fieldName?: string
  /**
   * A field's value is whatever its field type stores, a string as often as
   * an object, so this is pylon's `Any` scalar. Pylon renders a TypeScript
   * `any` as the NON-NULL `Any!` and there is no spelling that makes it
   * nullable, so `value` is always sent: a kind that carries none sends `{}`,
   * which every branch below ignores.
   */
  value?: any | null | undefined
  /**
   * Two things, by kind. For `fieldWrite` it is the field's own props. For
   * the three section kinds it is the structural remainder of the redux
   * payload, `between`, `move` and `sectionItemType`, which no other kind
   * has. An object either way, so this one is `JSONObject` and may be
   * omitted.
   */
  props?: Record<string, any> | null
  /** The client's instant. Advisory: the agent stamps its own. */
  at?: string
}

/** A field a change replaced, together with who had written it and when. */
export interface FieldOverwrite {
  field: string
  previousAuthor?: string
  previousAt?: string
}

export interface ApplyResult {
  /** The keys of ./types FieldAuthors this batch touched. */
  touched: string[]
  overwrote: FieldOverwrite[]
  /** A one line summary, the first half of the commit message. */
  summary: string
}

const nowIso = () => new Date().toISOString()

const pathKey = (path: SectionPath | undefined): string =>
  (path ?? [])
    .map(entry => [entry.fieldName, entry.sectionId].filter(Boolean).join('#'))
    .join('/')

/**
 * The stable name of a field, the key of `Draft.authors` and of the
 * `overwrote` list. It has to survive a rebase, so it is derived from the
 * change alone and never from a position in a document.
 */
export const fieldKey = (change: JaenChangeInput): string => {
  switch (change.kind) {
    case 'fieldWrite':
    case 'fieldMerge': {
      const inSection = change.section
        ? `${pathKey(change.section.path)}/${change.section.id ?? ''}/`
        : ''
      return `${change.pageId ?? ''}/${inSection}${change.fieldType ?? ''}/${change.fieldName ?? ''}`
    }
    case 'sectionAdd':
    case 'sectionRemove':
    case 'sectionMove':
      return `${change.pageId ?? ''}/sections/${pathKey(change.section?.path)}`
    case 'pageUpdate':
      return `${change.pageId ?? 'new'}/page`
    case 'pageDelete':
      return `${change.pageId ?? ''}/deleted`
    case 'siteMetadata':
      return 'site/siteMetadata'
    case 'widgetWrite':
      return `widget/${change.value?.id ?? 'new'}`
  }
}

const ensurePage = (draft: JaenDraft, pageId: string): JaenPageNode => {
  const existing = draft.pages[pageId]

  const page: JaenPageNode = {
    ...(existing ?? {}),
    childPages: existing?.childPages ?? []
  }

  draft.pages[pageId] = page

  return page
}

const applyFieldWrite = (draft: JaenDraft, change: JaenChangeInput): void => {
  const {pageId, section, fieldType, fieldName, value, props} = change

  if (!pageId) throw new Error('fieldWrite without a pageId')
  if (!fieldType || !fieldName) {
    throw new Error('fieldWrite without a fieldType or fieldName')
  }

  const page = ensurePage(draft, pageId)
  page.modifiedAt = nowIso()

  if (section) {
    page.sections = page.sections || []

    insertSectionIntoTree(page.sections, section.path, {
      sectionId: section.id,
      blockData: {
        jaenFields: {
          [fieldType]: {
            [fieldName]: {value, props}
          }
        }
      } as any
    })
  } else {
    page.jaenFields = page.jaenFields || {}
    page.jaenFields[fieldType] = {
      ...page.jaenFields[fieldType],
      [fieldName]: {
        ...page.jaenFields[fieldType]?.[fieldName],
        value,
        props
      }
    }
  }
}

/**
 * A field that holds a record, written by its changed keys instead of whole.
 *
 * The media library is the one field in jaen that works this way: the gallery
 * reads `media_nodes` as one object of 140 entries and writes the whole object
 * back on every upload, clone, edit and delete, so a picture used to send the
 * entire catalogue up the wire and commit the entire catalogue back down. The
 * client sends the entries that changed and the ids that went, and this merges
 * them onto whatever the repository holds now, which also means two editors
 * uploading at the same time no longer overwrite each other's node.
 *
 * A merge whose base is missing is a write of what it was given, which is the
 * honest answer: the client only sends a merge when it has the remote value to
 * diff against.
 */
const applyFieldMerge = (draft: JaenDraft, change: JaenChangeInput): void => {
  const {pageId, fieldType, fieldName} = change

  if (!pageId) throw new Error('fieldMerge without a pageId')
  if (!fieldType || !fieldName) {
    throw new Error('fieldMerge without a fieldType or fieldName')
  }

  const page = ensurePage(draft, pageId)
  page.modifiedAt = nowIso()
  page.jaenFields = page.jaenFields || {}

  const field = page.jaenFields[fieldType]?.[fieldName]
  const previous = field?.value

  const merged: Record<string, unknown> =
    previous && typeof previous === 'object' && !Array.isArray(previous)
      ? {...(previous as Record<string, unknown>)}
      : {}

  const removed = Array.isArray(change.props?.removed)
    ? (change.props!.removed as unknown[])
    : []

  for (const key of removed) {
    if (typeof key === 'string') delete merged[key]
  }

  const added = change.value

  if (added && typeof added === 'object' && !Array.isArray(added)) {
    Object.assign(merged, added as Record<string, unknown>)
  }

  page.jaenFields[fieldType] = {
    ...page.jaenFields[fieldType],
    [fieldName]: {...field, value: merged}
  }
}

const applySection = (draft: JaenDraft, change: JaenChangeInput): void => {
  const {pageId, section, props} = change

  if (!pageId) throw new Error(`${change.kind} without a pageId`)
  if (!section?.path) throw new Error(`${change.kind} without a section path`)

  const page = ensurePage(draft, pageId)
  const sections: JaenSection[] = page.sections || []

  const between = (props?.between ?? [null, null]) as [
    string | null,
    string | null
  ]

  if (change.kind === 'sectionAdd') {
    if (!props?.sectionItemType) {
      throw new Error('sectionAdd without props.sectionItemType')
    }

    insertSectionIntoTree(sections, section.path, {
      between,
      blockData: {type: props.sectionItemType} as any
    })
  } else if (change.kind === 'sectionRemove') {
    if (!section.id) throw new Error('sectionRemove without a section id')

    insertSectionIntoTree(sections, section.path, {
      between,
      sectionId: section.id,
      shouldDelete: true
    })
  } else {
    if (!section.id) throw new Error('sectionMove without a section id')
    if (!props?.move) throw new Error('sectionMove without props.move')

    insertSectionIntoTree(sections, section.path, {
      between,
      sectionId: section.id,
      move: props.move
    })
  }

  page.sections = sections
  page.modifiedAt = nowIso()
}

const applyPageUpdate = (draft: JaenDraft, change: JaenChangeInput): string => {
  const payload = (change.value ?? {}) as JaenPageNode & {
    id?: string
    fromId?: string
  }

  let id = change.pageId ?? payload.id
  const {
    slug,
    jaenFields,
    sections,
    jaenPageMetadata,
    parentPage,
    childPages,
    template,
    excludedFromIndex,
    fromId,
    childPagesOrder = [],
    createdBy
  } = payload

  const parentPageId = parentPage?.id || null
  const modifiedAt = nowIso()

  if (id) {
    const existing = draft.pages[id] ?? {}

    draft.pages[id] = {
      ...existing,
      id,
      modifiedAt,
      ...(slug !== undefined && {slug}),
      ...(jaenFields !== undefined && {jaenFields}),
      ...(sections !== undefined && {sections}),
      ...(parentPage !== undefined && {parentPage}),
      ...(childPages !== undefined && {childPages}),
      ...(excludedFromIndex !== undefined && {excludedFromIndex}),
      ...(template !== undefined && {template}),
      childPagesOrder,
      jaenPageMetadata: {
        ...existing.jaenPageMetadata,
        ...jaenPageMetadata
      }
    }

    // A move: the page leaves the old parent's childPages as a tombstone,
    // which is what the build merges over the sourced tree.
    if (fromId && (parentPageId || parentPageId === null)) {
      const from = draft.pages[fromId] ?? {}

      draft.pages[fromId] = {
        ...from,
        modifiedAt,
        childPages: [
          ...(from.childPages || []).filter(e => e.id !== id),
          {id, deleted: true}
        ]
      }
    }
  } else {
    if (fromId) throw new Error('Cannot move a page that is being created.')

    id = `JaenPage ${uuidv4()}`

    draft.pages[id] = {
      id,
      createdAt: modifiedAt,
      modifiedAt,
      createdBy,
      slug,
      jaenFields: jaenFields || null,
      sections,
      jaenPageMetadata: jaenPageMetadata || {title: 'New Page'},
      parentPage: parentPage || null,
      childPages: childPages || [],
      template,
      excludedFromIndex,
      childPagesOrder
    }
  }

  if (parentPageId) {
    const parent = draft.pages[parentPageId] ?? {}
    const parentChildren = parent.childPages || [{id}]

    if (!parentChildren.find(e => e.id === id)) parentChildren.push({id})

    draft.pages[parentPageId] = {
      modifiedAt,
      ...parent,
      childPages: parentChildren
    }
  }

  return id
}

const applyOne = (draft: JaenDraft, change: JaenChangeInput): void => {
  switch (change.kind) {
    case 'fieldWrite':
      return applyFieldWrite(draft, change)

    case 'fieldMerge':
      return applyFieldMerge(draft, change)

    case 'sectionAdd':
    case 'sectionRemove':
    case 'sectionMove':
      return applySection(draft, change)

    case 'pageUpdate': {
      applyPageUpdate(draft, change)
      return
    }

    case 'pageDelete': {
      if (!change.pageId) throw new Error('pageDelete without a pageId')

      const page = ensurePage(draft, change.pageId)
      page.deleted = true
      return
    }

    case 'siteMetadata': {
      draft.site = draft.site || {}
      draft.site.siteMetadata = {
        ...draft.site.siteMetadata,
        ...(change.value ?? {})
      }
      return
    }

    case 'widgetWrite': {
      const {id, isCreate, ...data} = (change.value ?? {}) as any

      if (id) {
        const node = draft.widgets.find(w => w.id === id)

        if (node) {
          node.modifiedAt = nowIso()
          node.data = data.data
          return
        }
      }

      if (!data.name) throw new Error('Widget name is required')

      const node: any = {id, ...data, modifiedAt: nowIso()}

      if (!node.id) node.id = Math.random().toString(36).substring(2, 11)
      if (isCreate && !data.createdAt) node.createdAt = node.modifiedAt

      draft.widgets.push(node)
      return
    }

    default: {
      const kind: never = change.kind
      throw new Error(`unknown change kind ${String(kind)}`)
    }
  }
}

/** The one line a commit message starts with. */
const summarise = (changes: JaenChangeInput[], pages: Set<string>): string => {
  const fields = changes.filter(
    c => c.kind === 'fieldWrite' || c.kind === 'fieldMerge'
  ).length
  const rest = changes.length - fields
  const parts: string[] = []

  if (fields) parts.push(`${fields} field${fields === 1 ? '' : 's'}`)
  if (rest) parts.push(`${rest} change${rest === 1 ? '' : 's'}`)

  const where =
    pages.size === 1
      ? ` on ${Array.from(pages)[0]}`
      : pages.size > 1
        ? ` on ${pages.size} pages`
        : ''

  return `edited ${parts.join(' and ') || 'nothing'}${where}`
}

/**
 * Applies a batch onto a draft in place, stamps the author of every field it
 * touched, and reports the fields whose remote value it replaced.
 *
 * `authors` is carried in the head patch beside the data, so a rebased save
 * can say who had written the value it just overwrote. A field the batch
 * writes for the first time is not an overwrite and is only stamped.
 */
export const applyChanges = (
  draft: JaenDraft,
  changes: JaenChangeInput[],
  authors: FieldAuthors,
  author: Pick<FieldAuthor, 'sub' | 'name'>,
  options?: {rebased?: boolean}
): ApplyResult => {
  const touched: string[] = []
  const overwrote: FieldOverwrite[] = []
  const pages = new Set<string>()
  const at = nowIso()

  for (const change of changes) {
    const key = fieldKey(change)
    const previous = authors[key]

    applyOne(draft, change)

    if (change.pageId) pages.add(change.pageId)

    // Only a rebase can overwrite somebody else's value: on a save whose
    // baseSha is the current head, the client already saw what it replaced.
    // A merge cannot overwrite: it applies the keys that changed onto
    // whatever the repository holds, so two editors adding a picture each
    // keep both pictures and neither replaced the other's value.
    if (
      options?.rebased &&
      previous &&
      previous.sub !== author.sub &&
      change.kind !== 'fieldMerge'
    ) {
      overwrote.push({
        field: key,
        previousAuthor: previous.name,
        previousAt: previous.at
      })
    }

    authors[key] = {sub: author.sub, name: author.name, at}
    touched.push(key)
  }

  return {touched, overwrote, summary: summarise(changes, pages)}
}
