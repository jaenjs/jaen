/**
 * One row of a detail page: a label and its value, design-consistency.md
 * rule 9.
 *
 * The transfer detail, the booking detail and the user detail each drew their
 * own label and value pair on Chakra's `DataList`, and each inherited the same
 * defect from the recipe. A horizontal `DataList.ItemValue` is
 * `display: flex; flex: 1; min-width: 0`, so the text inside it is an
 * anonymous flex item whose automatic minimum width is its longest word: a
 * 40 character mail address, a URL in a note or a code never shrinks below
 * that word, it overflows the value, paints over the card's edge and makes the
 * document wider than the viewport. The item is also `align-items: center`,
 * which puts a value that finally does wrap out of line with its label.
 *
 * The cure is here and not at a value: the value is a block, it breaks
 * anywhere (`overflow-wrap: anywhere`, which breaks a word only when it does
 * not fit, so ordinary German stays whole), it keeps `min-width: 0` so it may
 * shrink inside the row, and the label is a column of its own that never grows
 * past 40 per cent of the row and never shrinks below its own width. The row
 * aligns at the top, so a value of three lines still starts beside its label.
 *
 * The value is data, so it carries rule 11's mark and stays selectable inside
 * an app whose chrome is not (see Selectable.tsx).
 */
import React from 'react'
import {DataList} from '@chakra-ui/react'

export interface DetailRowProps {
  label: string
  value?: React.ReactNode
  /** A code or an id: the mono face at the smaller size. */
  mono?: boolean
  /** Nothing is drawn at all when the value is empty, the booking's way. */
  hideEmpty?: boolean
  /** What an empty value reads as, the en dash by default. */
  placeholder?: React.ReactNode
}

const isEmpty = (value: React.ReactNode): boolean =>
  value === undefined || value === null || value === ''

export function DetailRow({
  label,
  value,
  mono,
  hideEmpty,
  placeholder = '–'
}: DetailRowProps) {
  if (hideEmpty && isEmpty(value)) return null
  return (
    <DataList.Item alignItems="flex-start" minW="0">
      <DataList.ItemLabel
        minW={{base: '20', md: '32'}}
        maxW="40%"
        flexShrink="0"
        overflowWrap="anywhere">
        {label}
      </DataList.ItemLabel>
      <DataList.ItemValue
        data-selectable
        display="block"
        minW="0"
        overflowWrap="anywhere"
        fontFamily={mono ? 'mono' : undefined}
        textStyle={mono ? 'xs' : undefined}>
        {isEmpty(value) ? placeholder : value}
      </DataList.ItemValue>
    </DataList.Item>
  )
}
