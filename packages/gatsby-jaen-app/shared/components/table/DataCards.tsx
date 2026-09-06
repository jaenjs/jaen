/**
 * The same rows as cards, below `md`: a day header box per section with the
 * date's tone on its right edge, then one card per row. Which card is the
 * screen's choice through `card`, the board hands in its TransferCard. A
 * screen without a card of its own gets DefaultCard, built from the columns:
 * the first visible column as the title line, the rest as label and value.
 */
import React, {useState, type ReactNode} from 'react'
import {Box, HStack, Stack, Text} from '@chakra-ui/react'
import type {DataColumn} from './columns'

export type DayTone = 'green' | 'yellow' | undefined

export interface CardApi {
  expanded: boolean
  toggle: () => void
  /** WHEN, on the right edge: green today, yellow tomorrow. */
  tone: DayTone
}

export interface Section<Row> {
  key: string
  tone: DayTone
  rows: Row[]
}

export interface DataCardsProps<Row> {
  sections: Section<Row>[]
  rowId: (row: Row) => string
  /** The day header's words. Absent when the rows are not grouped. */
  label?: (key: string) => string
  card: (row: Row, api: CardApi) => ReactNode
}

export function DataCards<Row>({sections, rowId, label, card}: DataCardsProps<Row>) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return (
    <Stack gap="3">
      {sections.map(section => (
        <React.Fragment key={section.key || 'none'}>
          {label && (
            <Box
              colorPalette={section.tone}
              px="3"
              py="1.5"
              rounded="md"
              bg={section.tone ? 'colorPalette.subtle' : 'bg.subtle'}
              borderInlineEndWidth="4px"
              borderInlineEndColor={section.tone ? 'colorPalette.solid' : 'transparent'}>
              <Text textStyle="sm" fontWeight="semibold" color={section.tone ? 'colorPalette.fg' : 'fg.muted'}>
                {label(section.key)}
              </Text>
            </Box>
          )}
          {section.rows.map(row => {
            const id = rowId(row)
            return (
              <React.Fragment key={id}>
                {card(row, {expanded: expanded.has(id), toggle: () => toggle(id), tone: section.tone})}
              </React.Fragment>
            )
          })}
        </React.Fragment>
      ))}
    </Stack>
  )
}

export interface DefaultCardProps<Row> {
  row: Row
  columns: DataColumn<Row>[]
  tone: DayTone
  /** WHO, on the left edge. */
  stripe?: string
  onOpen: (row: Row) => void
}

/** The card a screen gets for free: the board's frame around the visible columns. */
export function DefaultCard<Row>({row, columns, tone, stripe, onOpen}: DefaultCardProps<Row>) {
  const [first, ...rest] = columns
  return (
    <Box
      rounded="lg"
      borderWidth="1px"
      borderColor="border.default"
      bg="bg.surface"
      p="3"
      w="full"
      minW="0"
      colorPalette={tone}
      borderInlineStartWidth="4px"
      borderInlineStartColor={stripe ?? 'border.emphasized'}
      borderInlineEndWidth={tone ? '4px' : '1px'}
      borderInlineEndColor={tone ? 'colorPalette.solid' : 'border.default'}
      onClick={() => onOpen(row)}
      cursor="pointer">
      {first && (
        <Box textStyle="sm" fontWeight="semibold" minW="0">
          {first.cell(row)}
        </Box>
      )}
      {rest.length > 0 && (
        <Stack gap="1.5" mt="2" textStyle="sm">
          {rest.map(c => (
            <HStack key={c.id} gap="2" align="flex-start">
              <Text color="fg.muted" w="24" flexShrink={0}>
                {c.label}
              </Text>
              <Box minW="0" flex="1" textAlign={c.align === 'end' ? 'end' : undefined}>
                {c.cell(row)}
              </Box>
            </HStack>
          ))}
        </Stack>
      )}
    </Box>
  )
}
