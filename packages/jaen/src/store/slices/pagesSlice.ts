import {createSlice, PayloadAction, DeepPartial} from '@reduxjs/toolkit'
import update from 'immutability-helper'
import {v4 as uuidv4} from 'uuid'

import {omitSingle} from '../../utils/helpers'
import {JaenPage, JaenSection, JaenSectionWithId} from '../../utils/types'

export interface JaenPagesState extends Omit<Partial<JaenPage>, 'sections'> {
  id: JaenPage['id']
  children: {id: string; deleted?: true}[]
  chapters?: JaenPage['chapters']
  deleted?: true
}

export interface PagePayload extends Partial<JaenPage> {
  id?: JaenPage['id']
  fromId?: string
}

const initialState = [] as JaenPagesState[]

const pagesSlice = createSlice({
  name: 'pages',
  initialState,
  reducers: {
    page_updateOrCreate(state, action: PayloadAction<PagePayload>) {
      let {
        id,
        slug,
        jaenFields = null,
        jaenPageMetadata = {
          title: 'New Page'
        },
        parent = null,
        children = [],
        fromId
      } = action.payload

      const parentId = parent?.id || null

      // Check if the page is being updated or created
      if (id) {
        // Update the page
        const pageIndex = state.findIndex(page => page.id === id)

        const toBeAddedData = {
          id,
          slug,
          jaenFields,
          jaenPageMetadata,
          parent,
          children
        }

        // If the page is not found, push a new one to the state
        if (pageIndex === -1) {
          state = update(state, {
            $push: [toBeAddedData]
          })
        } else {
          // Update the page
          state = update(state, {
            [pageIndex]: {
              $merge: {
                ...toBeAddedData
              }
            }
          })
        }

        const parentId = parent?.id
        // If `fromId` then remove the page from the fromPage children
        if (fromId && parentId) {
          // Update the from page
          let fromIndex = state.findIndex(page => page.id === fromId)

          // If the fromIndex is not found, add the fromPage to the state and set the from index
          if (fromIndex === -1) {
            state = update(state, {
              $push: [{id: fromId, children: []}]
            })
            fromIndex = state.length - 1
          }

          const fromPage = state[fromIndex]
          const fromChildren = fromPage.children.filter(
            child => child.id !== id
          )
          state = update(state, {
            [fromIndex]: {children: {$set: fromChildren}}
          })
        }
      } else {
        // If `fromId` is defined, throw an error because a page move is not supported on creation.
        if (fromId) {
          throw new Error(`Cannot move a page that is being created.`)
        }

        // Generate a new id in the pattern of `JaenPage {uuid}`
        id = `JaenPage ${uuidv4()}`

        // Create the page
        state = update(state, {
          $push: [
            {
              id,
              slug,
              jaenFields,
              jaenPageMetadata,
              parent,
              children
            }
          ]
        })
      }

      // Add the page to the new parents' children
      if (parentId) {
        let parentIndex = state.findIndex(page => page.id === parentId)

        // If the parent is not found, add the parent to the state and set the parent index
        if (parentIndex === -1) {
          state = update(state, {
            $push: [
              {
                id: parentId,
                children: []
              }
            ]
          })

          // Update the parent index to the newly added parent
          parentIndex = state.length - 1
        }

        // Then update the parent's children

        const parentPage = state[parentIndex]
        const newParentChildren = [...parentPage.children, {id}]
        state = update(state, {
          [parentIndex]: {children: {$set: newParentChildren}}
        })

        if (parentIndex !== -1) {
        } else {
        }
      }

      return state
    },
    page_markForDeletion(state, action: PayloadAction<string>) {
      const id = action.payload
      const index = state.findIndex(page => page.id === id)

      // If the page is found, mark it as deleted
      if (index !== -1) {
        state = update(state, {
          [index]: {deleted: {$set: true}}
        })
      } else {
        // If the page is not found, add it to the state
        state = update(state, {
          $push: [{id, children: [], deleted: true}]
        })
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

      console.log('section_Add', pageId, chapterName, sectionName, between)

      let pageIndex = state.findIndex(page => page.id === pageId)

      // If the page is not found, create it
      if (pageIndex === -1) {
        state = update(state, {
          $push: [{id: pageId, children: []}]
        })

        pageIndex = state.length - 1
      }

      const page = state[pageIndex]

      // If the page is found, add the section

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
      // find the page
      let pageIndex = state.findIndex(page => page.id === action.payload.pageId)

      // If the page is not found, add it to the state
      if (pageIndex === -1) {
        state = update(state, {
          $push: [{id: action.payload.pageId, children: []}]
        })

        pageIndex = state.length - 1
      }

      // If the chapter is not found, add it to the state
      const page = state[pageIndex]
      page.chapters = page.chapters || {}

      if (!page.chapters[action.payload.chapterName]?.sections) {
        // @ts-ignore - This is a hack to ignore the fact that no head or tail pointer is defined
        page.chapters[action.payload.chapterName] = {
          sections: {}
        }
      }

      const chapter = page.chapters[action.payload.chapterName]

      // Remove the section from the chapter
      chapter.sections = {
        ...chapter.sections,
        [action.payload.sectionId]: {
          ...chapter.sections[action.payload.sectionId],
          deleted: true
        }
      }

      //> It is required to rearrange the pointers of the between sections
      let [prev, next] = action.payload.between

      const prevWithoutId = prev && (omitSingle('id', prev) as JaenSection)
      const nextWithoutId = next && (omitSingle('id', next) as JaenSection)

      console.log(prevWithoutId, nextWithoutId)

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

      let pageIndex = state.findIndex(page => page.id === pageId)

      // If the page is not found, create it
      if (pageIndex === -1) {
        state = update(state, {
          $push: [{id: pageId, children: []}]
        })

        pageIndex = state.length - 1
      }

      const page = state[pageIndex]

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
