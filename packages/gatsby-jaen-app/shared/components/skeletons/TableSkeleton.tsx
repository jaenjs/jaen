/**
 * The board's table before its rows are there.
 *
 * The header row is the real one, the screen's column words in the account's
 * language, so the heading of every column stands still while the rows
 * arrive. Under it one day header row and eight rows of grey blocks, each
 * with the two stripes the board draws, WHO on the left and WHEN on the
 * right (dispatch.md, "The two stripes"), in the skeleton's grey. The blocks
 * vary in width from row to row so the table reads as rows and not as a
 * grid of equal bars. `avatar` puts a circle at the start of the first cell,
 * for the people of the users screen and the swatch of the fleet.
 *
 * Drawn by DataTable while its data is loading with nothing cached, and by a
 * screen that knows its columns before it knows its rows.
 */
import {Box, HStack, Skeleton, SkeletonCircle, Table, type SystemStyleObject} from '@chakra-ui/react'

export interface SkeletonColumn {
  id: string
  label: string
  width: number
  align?: 'start' | 'end'
}

export interface TableSkeletonProps {
  columns: SkeletonColumn[]
  /** How many grey rows, eight by default, the height of the board's first page. */
  rows?: number
  /** A circle at the start of the first cell. */
  avatar?: boolean
  /** The day header row under the header, on by default. */
  dayHeader?: boolean
  /** The width the last column reserves for the Details button. */
  actionsWidth?: number
}

/** The widths of the blocks in one row, as fractions of the column, row by row. */
const WIDTHS = [0.7, 0.55, 0.8, 0.6, 0.75, 0.5, 0.65, 0.85]

/** The stripe on one edge of a cell, the skeleton's grey. */
const stripe = (edge: 'start' | 'end'): SystemStyleObject => ({
  content: '""',
  position: 'absolute',
  insetY: '0',
  w: '4px',
  bg: 'bg.emphasized',
  ...(edge === 'start' ? {insetStart: '0'} : {insetEnd: '0'})
})

export function TableSkeleton({
  columns,
  rows = 8,
  avatar = false,
  dayHeader = true,
  actionsWidth = 72
}: TableSkeletonProps) {
  const minWidth = columns.reduce((sum, c) => sum + c.width, actionsWidth)
  return (
    <Table.ScrollArea borderWidth="1px" rounded="lg" bg="bg.surface" data-skeleton="table" aria-busy="true">
      <Table.Root size="sm" variant="line" tableLayout="fixed" style={{minWidth}}>
        <Table.Header>
          <Table.Row bg="bg.subtle">
            {columns.map(c => (
              <Table.ColumnHeader
                key={c.id}
                style={{width: c.width}}
                color="fg.muted"
                whiteSpace="nowrap"
                textAlign={c.align === 'end' ? 'end' : undefined}>
                {c.label}
              </Table.ColumnHeader>
            ))}
            <Table.ColumnHeader style={{width: actionsWidth}} />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {dayHeader && (
            <Table.Row bg="bg.subtle">
              <Table.Cell colSpan={columns.length + 1} py="1.5" position="relative" _before={stripe('start')} _after={stripe('end')}>
                <Skeleton h="4" w="36" rounded="sm" />
              </Table.Cell>
            </Table.Row>
          )}
          {Array.from({length: rows}, (_, r) => (
            <Table.Row key={r}>
              {columns.map((c, i) => (
                <Table.Cell
                  key={c.id}
                  verticalAlign="middle"
                  style={{width: c.width}}
                  position={i === 0 ? 'relative' : undefined}
                  _before={i === 0 ? stripe('start') : undefined}>
                  <HStack gap="3" justify={c.align === 'end' ? 'flex-end' : undefined}>
                    {i === 0 && avatar && <SkeletonCircle size="8" flexShrink={0} />}
                    <Skeleton
                      h="4"
                      rounded="sm"
                      w={`${Math.round((WIDTHS[(r + i) % WIDTHS.length] ?? 0.6) * 100)}%`}
                      maxW={`${Math.round(c.width * 0.9)}px`}
                    />
                  </HStack>
                </Table.Cell>
              ))}
              <Table.Cell
                verticalAlign="middle"
                style={{width: actionsWidth}}
                position="relative"
                _before={columns.length === 0 ? stripe('start') : undefined}
                _after={stripe('end')}>
                <Box>
                  <Skeleton h="4" w="12" rounded="sm" />
                </Box>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Table.ScrollArea>
  )
}
