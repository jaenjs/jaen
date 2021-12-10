import {createSlice, PayloadAction, DeepPartial} from '@reduxjs/toolkit'
import update from 'immutability-helper'
import {v4 as uuidv4} from 'uuid'

import {JaenPage} from '../../utils/types'

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
        componentName: string
        between: [string | null, string | null]
      }>
    ) {
      const {pageId, chapterName, componentName, position} = action.payload

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

      // Generate a new id in the pattern of `JaenSection {uuid}`
      const sectionId = `JaenSection ${uuidv4()}`

      // If `position.sectionId` is defined, then the section is added to the chapter at the specified position

      // Add the section to the page
      page.chapters[chapterName] = {
        ...page.chapters[chapterName],
        [sectionId]: {
          jaenFields: null,
          componentName,
          ptrTo: null,
          ptrFrom: null
        }
      }

      return state
    },

    section_move(
      state,
      action: PayloadAction<{id: string; from: string; to: string}>
    ) {
      const {id, from, to} = action.payload

      const pageIndex = state.findIndex(page => page.id === from)
    }
  }
})

export const {
  page_updateOrCreate,
  page_markForDeletion,
  section_add
} = pagesSlice.actions
export default pagesSlice.reducer
