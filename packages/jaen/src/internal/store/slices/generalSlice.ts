import {createSlice, PayloadAction} from '@reduxjs/toolkit'

import {generatePagePaths} from '@src/internal/root/paths'
import {TreeJaenPage} from '@src/internal/types'

export interface GeneralState {
  isEditing: boolean
  dynamicPaths: {
    [path: string]: {
      pageId: string
      templateName: string
    }
  }
}

const initialState: GeneralState = {
  isEditing: false,
  dynamicPaths: {}
}

const generalSlice = createSlice({
  name: 'general',
  initialState,
  reducers: {
    setEditing: (state, action: PayloadAction<boolean>) => {
      state.isEditing = action.payload
    },
    updateDynamicPaths(
      state,
      action: PayloadAction<{
        jaenPageTree: TreeJaenPage[]
        pageId: string
        create?: boolean
      }>
    ) {
      const {jaenPageTree, pageId, create} = action.payload

      const dynamicIds = Object.fromEntries(
        Object.entries(state.dynamicPaths).map(([k, v]) => [v.pageId, k])
      )

      const node = jaenPageTree.find(node => node.id === pageId)

      const paths = generatePagePaths(jaenPageTree, pageId)

      for (const path in paths) {
        const pageId = paths[path]

        if (pageId in dynamicIds) {
          const oldPath = dynamicIds[pageId]
          delete state.dynamicPaths[oldPath]
        }

        if (create) {
          state.dynamicPaths[path] = {
            pageId,
            templateName: node?.template?.name!
          }
        }
      }
    }
  }
})

export const {setEditing, updateDynamicPaths} = generalSlice.actions

export default generalSlice.reducer
