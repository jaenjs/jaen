/**
 * The one implementation of "what a change does".
 *
 * A change is one dispatched redux action of the three draft-bearing slices,
 * named and flattened, so the browser sends what it already produces and the
 * jaen agent needs no diffing. Both sides apply it through this file: the
 * browser to fold the outbox back onto a document it just polled, the agent to
 * fold a save onto the document it just read from the repository. If the two
 * had their own copy they would eventually disagree about what `sectionMove`
 * means, and the disagreement would be a commit nobody can explain.
 *
 * Nothing here touches redux. It works on a plain draft state so the agent,
 * which has no store, can import it unchanged.
 */
import {JaenPage, SectionType, Widget} from '../types'
import {deepRemoveUndefinedProperties} from '../utils/deep-remove-undefined-properties'
import {insertSectionIntoTree} from '../utils/page/section'
import {IJaenSiteState} from './types'

export type JaenChangeKind =
  | 'fieldWrite'
  | 'sectionAdd'
  | 'sectionRemove'
  | 'sectionMove'
  | 'pageUpdate'
  | 'pageDelete'
  | 'siteMetadata'
  | 'widgetWrite'

/**
 * The wire shape, one to one with `JaenChangeInput` of the agent's schema.
 *
 * `value` carries a field's value and nothing else. `props` is the rest of the
 * originating action's payload, which differs per kind and is JSON either way:
 *
 *   fieldWrite     value = the field's value, props = its props
 *   sectionAdd     props = {sectionItemType, between}
 *   sectionRemove  props = {between}
 *   sectionMove    props = {between, move}
 *   pageUpdate     value = the page payload of page_updateOrCreate
 *   pageDelete     pageId says everything
 *   siteMetadata   value = the metadata partial
 *   widgetWrite    value = the widget payload of writeData
 *
 * `at` is the client's instant and is advisory. The agent stamps the author
 * itself out of the introspected token and ignores anything the client claims
 * about who wrote a change.
 */
export interface JaenChange {
  kind: JaenChangeKind
  pageId?: string
  section?: {
    path: SectionType['path']
    id?: string
  }
  fieldType?: string
  fieldName?: string
  value?: any
  props?: any
  at: string
}

/** Who last wrote a field, kept beside the data in the head patch. */
export interface JaenAuthor {
  sub: string
  name?: string
  at: string
}

export type JaenAuthors = Record<string, JaenAuthor>

/**
 * The working form of a draft: pages keyed by id, the way the redux page slice
 * holds them.
 */
export interface JaenDraftState {
  pages: Record<string, Partial<JaenPage>>
  site: IJaenSiteState
  widgets: Widget[]
}

/**
 * The on-disk form of a draft, the `data` of a patch. Pages are an array with
 * an `id` because that is what `gatsby-source-jaen` deepmerges at build time,
 * and `jaen-data/live.json` has to stay a patch the build can read without
 * knowing anything about the agent.
 */
export interface JaenDraftData {
  pages?: Array<Partial<JaenPage> & {id: string}>
  site?: IJaenSiteState
  widgets?: Widget[]
}

export const emptyDraftState = (): JaenDraftState => ({
  pages: {},
  site: {siteMetadata: {}},
  widgets: []
})

export const draftDataToState = (
  data: JaenDraftData | null | undefined
): JaenDraftState => {
  const state = emptyDraftState()

  for (const page of data?.pages || []) {
    if (!page || !page.id) continue
    state.pages[page.id] = page
  }

  if (data?.site) {
    state.site = {siteMetadata: data.site.siteMetadata || {}}
  }

  state.widgets = data?.widgets || []

  return state
}

export const draftStateToData = (state: JaenDraftState): JaenDraftData => ({
  pages: Object.entries(state.pages).map(([id, page]) => ({...page, id})),
  site: state.site,
  widgets: state.widgets
})

/**
 * A stable name for the thing a change wrote, used as the key of the authors
 * map. Section fields are named by their section id rather than by their path,
 * because the path of a section can change while the field stays the same one.
 */
const pathKey = (path?: SectionType['path']): string =>
  (path || [])
    .map(entry => [entry.fieldName, entry.sectionId].filter(Boolean).join('#'))
    .join('/')

/**
 * The stable name of a field, the key of `Draft.authors` and of the agent's
 * `overwrote` list. It has to survive a rebase, so it is derived from the
 * change alone and never from a position in a document, and it is the same
 * string on both sides: `packages/jaen-agent/src/apply-change.ts`, `fieldKey`.
 */
export const changeKey = (change: JaenChange): string => {
  switch (change.kind) {
    case 'fieldWrite': {
      const inSection = change.section
        ? `${pathKey(change.section.path)}/${change.section.id ?? ''}/`
        : ''

      return `${change.pageId ?? ''}/${inSection}${change.fieldType ?? ''}/${
        change.fieldName ?? ''
      }`
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
    default:
      return 'unknown'
  }
}

/** The page node a change touches, created empty when it is not there yet. */
const touchPage = (state: JaenDraftState, pageId: string): JaenPage => {
  state.pages[pageId] = {
    ...state.pages[pageId],
    childPages: state.pages[pageId]?.childPages || []
  }

  return state.pages[pageId] as JaenPage
}

/**
 * Applies one change in place and returns the state it was given.
 *
 * `author`, when passed, is written into `authors` under the change's key, so
 * the CMS can say who last wrote a field and when. The agent passes the
 * introspected caller; the browser passes nothing while it folds its own
 * outbox back on, because an unsent change has no committed author yet.
 */
export const applyChange = (
  state: JaenDraftState,
  change: JaenChange,
  options?: {author?: JaenAuthor; authors?: JaenAuthors}
): JaenDraftState => {
  const at = change.at || new Date().toISOString()

  switch (change.kind) {
    case 'fieldWrite': {
      if (!change.pageId || !change.fieldType || !change.fieldName) break

      const page = touchPage(state, change.pageId)
      page.modifiedAt = at

      if (change.section?.id) {
        page.sections = page.sections || []

        insertSectionIntoTree(page.sections, change.section.path, {
          sectionId: change.section.id,
          blockData: {
            jaenFields: {
              [change.fieldType]: {
                [change.fieldName]: {
                  value: change.value,
                  props: change.props
                }
              }
            }
          } as any
        })
      } else {
        page.jaenFields = page.jaenFields || {}
        page.jaenFields[change.fieldType] = {
          ...page.jaenFields[change.fieldType],
          [change.fieldName]: {
            ...page.jaenFields[change.fieldType]?.[change.fieldName],
            value: change.value,
            props: change.props
          }
        }
      }

      break
    }

    case 'sectionAdd': {
      if (!change.pageId || !change.section) break

      const page = touchPage(state, change.pageId)
      const sections = page.sections || []

      insertSectionIntoTree(sections, change.section.path, {
        between: change.props?.between,
        blockData: {
          type: change.props?.sectionItemType
        } as any
      })

      page.sections = sections
      break
    }

    case 'sectionRemove': {
      if (!change.pageId || !change.section?.id) break

      const page = touchPage(state, change.pageId)
      const sections = page.sections || []

      insertSectionIntoTree(sections, change.section.path, {
        between: change.props?.between,
        sectionId: change.section.id,
        shouldDelete: true
      })

      page.sections = sections
      break
    }

    case 'sectionMove': {
      if (!change.pageId || !change.section?.id) break

      const page = touchPage(state, change.pageId)
      const sections = page.sections || []

      insertSectionIntoTree(sections, change.section.path, {
        between: change.props?.between,
        sectionId: change.section.id,
        move: change.props?.move
      })

      page.sections = sections
      break
    }

    case 'pageUpdate': {
      const payload = (change.value || {}) as Partial<JaenPage> & {
        id?: string
        fromId?: string
      }

      // The id is resolved by the recorder, never here. `page_updateOrCreate`
      // mints one when the payload has none and the browser has already read
      // it back off `lastAddedNodeId`, so a save never invents a second id for
      // a page that exists.
      const id = change.pageId || payload.id
      if (!id) break

      const {fromId, ...rest} = payload
      const parentPageId = rest.parentPage?.id || null
      const exists = state.pages[id] !== undefined

      if (exists) {
        // The update path of the reducer, key for key: a page's template and
        // its author are written once and are not the update's to change.
        const toBeAdded = deepRemoveUndefinedProperties({
          id,
          modifiedAt: at,
          ...(rest.slug && {slug: rest.slug}),
          ...(rest.jaenFields !== undefined && {jaenFields: rest.jaenFields}),
          ...(rest.sections !== undefined && {sections: rest.sections}),
          jaenPageMetadata: rest.jaenPageMetadata,
          ...(rest.parentPage !== undefined && {parentPage: rest.parentPage}),
          ...(rest.childPages && {childPages: rest.childPages}),
          ...(rest.excludedFromIndex !== undefined && {
            excludedFromIndex: rest.excludedFromIndex
          }),
          childPagesOrder: rest.childPagesOrder || []
        }) as Partial<JaenPage>

        state.pages[id] = {
          ...state.pages[id],
          ...toBeAdded,
          jaenPageMetadata: {
            ...state.pages[id]?.jaenPageMetadata,
            ...rest.jaenPageMetadata
          } as JaenPage['jaenPageMetadata']
        }

        if (fromId && (parentPageId || parentPageId === null)) {
          state.pages[fromId] = {
            ...state.pages[fromId],
            modifiedAt: at,
            childPages: [
              ...(state.pages[fromId]?.childPages || []).filter(
                e => e.id !== id
              ),
              {id, deleted: true}
            ]
          }
        }
      } else {
        state.pages[id] = {
          createdAt: at,
          modifiedAt: at,
          createdBy: rest.createdBy,
          slug: rest.slug,
          jaenFields: rest.jaenFields || null,
          sections: rest.sections,
          jaenPageMetadata: rest.jaenPageMetadata || {title: 'New Page'},
          parentPage: rest.parentPage || null,
          childPages: rest.childPages || [],
          template: rest.template,
          excludedFromIndex: rest.excludedFromIndex,
          childPagesOrder: rest.childPagesOrder || []
        }
      }

      if (parentPageId) {
        const childPages = state.pages[parentPageId]?.childPages || [{id}]

        if (!childPages.find(e => e.id === id)) {
          childPages.push({id})
        }

        state.pages[parentPageId] = {
          modifiedAt: at,
          ...state.pages[parentPageId],
          childPages
        }
      }

      break
    }

    case 'pageDelete': {
      if (!change.pageId) break

      state.pages[change.pageId] = {
        ...state.pages[change.pageId],
        deleted: true,
        childPages: state.pages[change.pageId]?.childPages || []
      }

      break
    }

    case 'siteMetadata': {
      state.site = {
        siteMetadata: {
          ...state.site?.siteMetadata,
          ...(change.value || {})
        }
      }

      break
    }

    case 'widgetWrite': {
      const {id, isCreate, ...data} = (change.value ||
        {}) as Partial<Widget> & {
        isCreate?: boolean
      }

      if (id) {
        const node = state.widgets.find(node => node.id === id)

        if (node) {
          node.modifiedAt = at
          node.data = (data as any).data
          break
        }
      }

      if (!data.name) break

      const node: any = {id, ...data, modifiedAt: at}

      if (isCreate && !data.createdAt) {
        node.createdAt = at
      }

      state.widgets.push(node)
      break
    }
  }

  if (options?.authors && options.author) {
    options.authors[changeKey(change)] = {...options.author, at}
  }

  return state
}

/** Applies a batch in order. The later change of one field wins, as always. */
export const applyChanges = (
  state: JaenDraftState,
  changes: JaenChange[],
  options?: {author?: JaenAuthor; authors?: JaenAuthors}
): JaenDraftState => {
  for (const change of changes) {
    applyChange(state, change, options)
  }

  return state
}

/**
 * Which fields of `before` a batch is about to overwrite, with who had written
 * them. The agent answers this as `SaveResult.overwrote` when it rebased a
 * stale save, so the CMS can say what it took away from whom.
 */
export interface FieldOverwrite {
  field: string
  previousAuthor?: JaenAuthor
}

export const overwrittenFields = (
  changes: JaenChange[],
  authors: JaenAuthors,
  since: string
): FieldOverwrite[] => {
  const seen = new Set<string>()
  const out: FieldOverwrite[] = []

  for (const change of changes) {
    const field = changeKey(change)
    if (seen.has(field)) continue
    seen.add(field)

    const previous = authors[field]

    if (previous && previous.at > since) {
      out.push({field, previousAuthor: previous})
    }
  }

  return out
}
