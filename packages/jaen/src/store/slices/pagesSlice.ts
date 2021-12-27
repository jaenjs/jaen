import {createSlice, PayloadAction, DeepPartial} from '@reduxjs/toolkit'
import update from 'immutability-helper'
import {v4 as uuidv4} from 'uuid'

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

      if (!page.chapters[chapterName].sections) {
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

        chapter.sections = update(chapter.sections, {
          [sectionId]: {
            $set: {
              name: sectionName,
              ptrPrev: null,
              ptrNext: null,
              jaenFields: null
            }
          }
        })

        // Set head and tail pointers
        chapter.ptrHead = sectionId
        chapter.ptrTail = sectionId
      } else if (prev && !next) {
        // If the after is defined, add the section before the after
        chapter.sections = update(chapter.sections, {
          [prev.id]: {
            ptrNext: {$set: sectionId}
          },
          [sectionId]: {
            $set: {
              name: sectionName,
              ptrPrev: prev.id,
              ptrNext: null,
              jaenFields: null
            }
          }
        })

        // Set head and tail pointers
        chapter.ptrTail = sectionId
      } else if (!prev && next) {
        // If the before is defined, add the section after the before
        chapter.sections = update(chapter.sections, {
          [next.id]: {
            ptrPrev: {$set: sectionId}
          },
          [sectionId]: {
            $set: {
              name: sectionName,
              ptrPrev: null,
              ptrNext: next.id,
              jaenFields: null
            }
          }
        })

        // Set head and tail pointers
        chapter.ptrHead = sectionId
      } else if (prev && next) {
        // cannot use else here because of the null check
        // If both before and after are defined, add the section between the before and after

        chapter.sections = update(chapter.sections, {
          [next.id]: {
            ptrPrev: {$set: sectionId}
          },
          [prev.id]: {
            ptrNext: {$set: sectionId}
          },
          [sectionId]: {
            $set: {
              name: sectionName,
              ptrPrev: prev.id,
              ptrNext: next.id,
              jaenFields: null
            }
          }
        })
      }

      return state
    },

    field_write(
      state,
      action: PayloadAction<{
        pageId: string
        section?: {chapterName: string; sectionId: string}
        fieldName: string
        value: any
      }>
    ) {
      const {pageId, section, fieldName, value} = action.payload

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
          // @ts-ignore - This is a hack to ignore the fact that no head or tail pointer is defined
          chapter.sections[section.sectionId] = {
            jaenFields: {}
          }
        }

        const sectionFields = chapter.sections[section.sectionId].jaenFields

        // @ts-ignore
        sectionFields[fieldName] = value
      } else {
        page.jaenFields = page.jaenFields || {}
        page.jaenFields[fieldName] = value
      }

      return state
    }
  }
})

export const {
  page_updateOrCreate,
  page_markForDeletion,
  section_add,
  field_write
} = pagesSlice.actions
export default pagesSlice.reducer
