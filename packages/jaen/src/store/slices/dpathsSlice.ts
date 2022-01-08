import {createSlice, PayloadAction} from '@reduxjs/toolkit'

import {generatePagePaths} from '../../utils/helpers'
import {TreeNode} from '../../utils/types'

export interface DpathsState {
  dynamicPaths: {
    [path: string]: {
      pageId: string
      templateName: string
    }
  }
}

const initialState: DpathsState = {
  dynamicPaths: {}
}

const dpathsSlice = createSlice({
  name: 'dpaths',
  initialState,
  reducers: {
    updateForPage(
      state,
      action: PayloadAction<{
        jaenPageTree: TreeNode[]
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

export const {updateForPage} = dpathsSlice.actions

export default dpathsSlice.reducer
