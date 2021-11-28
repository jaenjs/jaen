import {DeepPartial} from '@chakra-ui/react'
import {createSelector, Selector} from '@reduxjs/toolkit'
import {BlocksField, PlainField, ContentBlocks} from '@src/types'

import {RootState} from '..'

export const pageFieldContentSelector = (
  path: string,
  fieldName: string,
  block?: {typeName: string; position: number; blockFieldName: string}
): Selector<RootState, DeepPartial<ContentBlocks> | undefined> =>
  createSelector(
    (state: RootState) =>
      block
        ? (state.site.allSitePage?.nodes?.[path]?.fields?.[fieldName] as
            | BlocksField
            | undefined)?.blocks?.[block.position]?.fields?.[
            block.blockFieldName
          ]
        : (state.site.allSitePage?.nodes?.[path]?.fields?.[fieldName] as
            | PlainField
            | undefined)?.content,
    field => {
      return field
    }
  )

export const pageFieldBlocksSelector = (
  path: string,
  fieldName: string
): Selector<RootState, BlocksField['blocks']> =>
  createSelector(
    (state: RootState) =>
      (state.site.allSitePage?.nodes?.[path]?.fields?.[
        fieldName
      ] as BlocksField)?.blocks,
    blocks => blocks
  )
