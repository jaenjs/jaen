import {createSlice, PayloadAction} from '@reduxjs/toolkit'
import {v4 as uuidv4} from 'uuid'

import {JaenPage, JaenSection, JaenSectionWithId} from '@src/internal/types'
import {omitSingle} from '@src/internal/utils/helper'

export interface JaenPageState
  extends Omit<Partial<JaenPage>, 'sections' | 'id'> {
  children: {id: string; deleted?: true}[]
  chapters?: JaenPage['chapters']
  deleted?: true
}

export interface PagePayload extends Partial<JaenPage> {
  id?: JaenPage['id']
  fromId?: string
}

export interface JaenPagesState {
  pages: {[pageId: string]: JaenPageState}
  latestAddedPageId?: string
}

const initialState: JaenPagesState = {
  pages: {}
}

const pagesSlice = createSlice({
  name: 'pages',
  initialState,
  reducers: {
    page_updateOrCreate(state, action: PayloadAction<PagePayload>) {
      let {
        id,
        slug,
        jaenFields = null,
        jaenPageMetadata,
        parent,
        children,
        template,
        fromId
      } = action.payload

      const parentId = parent?.id || null

      // Check if the page is being updated or created
      if (id) {
        // Update the page
        const toBeAddedData = {
          id,
          ...(slug && {slug}),
          ...(jaenFields !== undefined && {jaenFields}),
          ...(jaenPageMetadata && {jaenPageMetadata}),
          ...(parent !== undefined && {parent}),
          ...(children && {children})
        }

        state.pages[id] = {
          ...state.pages[id],
          ...toBeAddedData
        }

        // If `fromId` then remove the page from the fromPage children
        if (fromId && (parentId || parentId === null)) {
          // Update the from page
          // If the fromIndex is not found, add the fromPage to the state and set the from index

          state.pages[fromId] = {
            ...state.pages[fromId],
            children:
              state.pages[fromId]?.children.filter(child => child.id !== id) ||
              []
          }
        }
      } else {
        // If `fromId` is defined, throw an error because a page move is not supported on creation.
        if (fromId) {
          throw new Error(`Cannot move a page that is being created.`)
        }

        // Generate a new id in the pattern of `JaenPage {uuid}`
        id = `JaenPage ${uuidv4()}`

        // Create the page
        state.pages[id] = {
          slug,
          jaenFields: jaenFields || null,
          jaenPageMetadata: jaenPageMetadata || {
            title: 'New Page'
          },
          parent: parent || null,
          children: children || [],
          template
        }

        state.latestAddedPageId = id
      }

      // Add the page to the new parents' children
      if (parentId) {
        state.pages[parentId] = {
          ...state.pages[parentId],
          children: state.pages[parentId]?.children
            ? [...state.pages[parentId]?.children, {id}]
            : [{id}]
        }
      }

      return state
    },
    page_markForDeletion(state, action: PayloadAction<string>) {
      const id = action.payload

      state.pages[id] = {
        ...state.pages[id],
        deleted: true,
        children: state.pages[id]?.children || []
      }

      return state
    },

    section_add(
      state,
      action: PayloadAction<{
        pageId: string
        chapterName: string
        sectionName: string
        between: [JaenSectionWithId | null, JaenSectionWithId | null]
      }>
    ) {
      const {pageId, chapterName, sectionName, between} = action.payload

      // Create the page if not found
      state.pages[pageId] = {
        ...state.pages[pageId],
        children: state.pages[pageId]?.children || []
      }

      const page = state.pages[pageId]

      page.chapters = page.chapters || {}

      if (!page.chapters[chapterName]?.sections) {
        // @ts-ignore - This is a hack to ignore the fact that no head or tail pointer is defined
        page.chapters[chapterName] = {
          sections: {}
        }
      }

      const chapter = page.chapters[chapterName]

      // Generate a new id in the pattern of `JaenSection {uuid}`
      const sectionId = `JaenSection ${uuidv4()}`

      const [prev, next] = between

      if (!prev && !next) {
        // If the before and after are not defined, add the section without changing
        // the pointers of other sections

        chapter.sections = {
          ...chapter.sections,
          [sectionId]: {
            name: sectionName,
            ptrPrev: null,
            ptrNext: null,
            jaenFields: null
          }
        }

        // Set head and tail pointers
        chapter.ptrHead = sectionId
        chapter.ptrTail = sectionId
      } else if (prev && !next) {
        // If the after is defined, add the section before the after
        chapter.sections = {
          ...chapter.sections,
          [sectionId]: {
            name: sectionName,
            ptrPrev: prev.id,
            ptrNext: null,
            jaenFields: null
          },
          [prev.id]: {
            ...chapter.sections[prev.id],
            ptrNext: sectionId
          }
        }

        // Set head and tail pointers
        chapter.ptrTail = sectionId
      } else if (!prev && next) {
        // If the before is defined, add the section after the before

        chapter.sections = {
          ...chapter.sections,
          [sectionId]: {
            name: sectionName,
            ptrPrev: null,
            ptrNext: next.id,
            jaenFields: null
          },
          [next.id]: {
            ...chapter.sections[next.id],
            ptrPrev: sectionId
          }
        }

        // Set head and tail pointers
        chapter.ptrHead = sectionId
      } else if (prev && next) {
        // cannot use else here because of the null check
        // If both before and after are defined, add the section between the before and after

        chapter.sections = {
          ...chapter.sections,
          [sectionId]: {
            name: sectionName,
            ptrPrev: prev.id,
            ptrNext: next.id,
            jaenFields: null
          },
          [prev.id]: {
            ...chapter.sections[prev.id],
            ptrNext: sectionId
          },
          [next.id]: {
            ...chapter.sections[next.id],
            ptrPrev: sectionId
          }
        }
      }

      return state
    },
    section_remove(
      state,
      action: PayloadAction<{
        pageId: string
        chapterName: string
        sectionId: string
        between: [JaenSectionWithId | null, JaenSectionWithId | null]
      }>
    ) {
      const {pageId, chapterName, sectionId, between} = action.payload

      // find the page
      // Create the page if not found
      state.pages[pageId] = {
        ...state.pages[pageId],
        children: state.pages[pageId]?.children || []
      }

      const page = state.pages[pageId]

      page.chapters = page.chapters || {}

      if (!page.chapters[chapterName]?.sections) {
        // @ts-ignore - This is a hack to ignore the fact that no head or tail pointer is defined
        page.chapters[chapterName] = {
          sections: {}
        }
      }

      const chapter = page.chapters[chapterName]

      // Remove the section from the chapter
      chapter.sections = {
        ...chapter.sections,
        [sectionId]: {
          ...chapter.sections[sectionId],
          deleted: true
        }
      }

      //> It is required to rearrange the pointers of the between sections
      let [prev, next] = between

      const prevWithoutId = prev && (omitSingle('id', prev) as JaenSection)
      const nextWithoutId = next && (omitSingle('id', next) as JaenSection)

      if (prev && !next) {
        // If next is not defined:
        // - set the prev section's next pointer to null
        // - set the tail pointer to the prev section's id

        chapter.sections = {
          ...chapter.sections,
          [prev.id]: {
            ...chapter.sections[prev.id],
            ...prevWithoutId,
            ptrNext: null
          }
        }

        chapter.ptrTail = prev.id
      } else if (!prev && next) {
        // If prev is not defined:
        // - set the next section's prev pointer to null
        // - set the head pointer to the next section's id

        chapter.sections = {
          ...chapter.sections,
          [next.id]: {
            ...chapter.sections[next.id],
            ...nextWithoutId,
            ptrPrev: null
          }
        }

        chapter.ptrHead = next.id
      } else if (prev && next) {
        // If both prev and next are defined:
        // - set the prev section's next pointer to the next section's id
        // - set the next section's prev pointer to the prev section's id

        chapter.sections = {
          ...chapter.sections,
          [prev.id]: {
            ...chapter.sections[prev.id],
            ...prevWithoutId,
            ptrNext: next.id
          },
          [next.id]: {
            ...chapter.sections[next.id],
            ...nextWithoutId,
            ptrPrev: prev.id
          }
        }
      } else {
        // If both prev and next are not defined:
        // - set the head and tail pointers to null

        chapter.ptrHead = null
        chapter.ptrTail = null
      }

      return state
    },

    field_write(
      state,
      action: PayloadAction<{
        pageId: string
        section?: {chapterName: string; sectionId: string}
        fieldType: string
        fieldName: string
        value: any
      }>
    ) {
      const {pageId, section, fieldType, fieldName, value} = action.payload

      // find the page
      // Create the page if not found
      state.pages[pageId] = {
        ...state.pages[pageId],
        children: state.pages[pageId]?.children || []
      }

      const page = state.pages[pageId]

      // If the page is found, add the field

      if (section) {
        page.chapters = page.chapters || {}

        if (!page.chapters[section.chapterName]?.sections) {
          // @ts-ignore - This is a hack to ignore the fact that no head or tail pointer is defined
          page.chapters[section.chapterName] = {
            sections: {}
          }
        }

        const chapter = page.chapters[section.chapterName]

        if (!chapter.sections[section.sectionId]?.jaenFields) {
          chapter.sections[section.sectionId] = {
            ...chapter.sections[section.sectionId],
            jaenFields: {}
          }
        }

        const sectionFields = chapter.sections[section.sectionId].jaenFields

        // @ts-ignore
        sectionFields[fieldType] = {
          ...sectionFields?.[fieldType],
          [fieldName]: value
        }
      } else {
        page.jaenFields = page.jaenFields || {}
        page.jaenFields[fieldType] = {
          ...page.jaenFields[fieldType],
          [fieldName]: value
        }
      }

      return state
    }
  }
})

export const {
  page_updateOrCreate,
  page_markForDeletion,
  section_add,
  section_remove,
  field_write
} = pagesSlice.actions
export default pagesSlice.reducer
