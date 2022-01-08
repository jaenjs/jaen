import {createSlice, PayloadAction} from '@reduxjs/toolkit'

import {generatePagePaths} from '../../utils/helpers'
import {TreeNode} from '../../utils/types'

export interface DpathsState {
  dynamicPaths: {[path: string]: string}
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
        Object.entries(state.dynamicPaths).map(([k, v]) => [v, k])
      )

      const paths = generatePagePaths(jaenPageTree, pageId)

      for (const path in paths) {
        const pageId = paths[path]

        if (pageId in dynamicIds) {
          const oldPath = dynamicIds[pageId]
          delete state.dynamicPaths[oldPath]
        }

        if (create) {
          state.dynamicPaths[path] = pageId
        }
      }
    }
  }
})

export const {updateForPage} = dpathsSlice.actions

export default dpathsSlice.reducer
