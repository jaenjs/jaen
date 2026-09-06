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
 *
 * It has to be cheap, because it is the first frame of a view and rule 4 of
 * design-consistency.md gives that frame 100 ms from the route change.
 * Measured on the live board at 1440: the hop from the Me page painted the
 * skeleton 87 to 102 ms after the route changed, half of it Chakra's style
 * engine resolving one style object per element. So the rows carry no style
 * an element could vary in: the widths of the blocks are inline styles, not
 * `w` and `maxW` props (every distinct pair was a cache miss and a CSS rule
 * inserted, 72 of them on the board), the block sits in the cell without an
 * HStack around it unless there is a circle beside it, and the first and
 * last cells share one style object each, so every element after the first
 * of its kind is a cache hit and no rule is inserted for it.
 */
import type {CSSProperties} from 'react'
import {HStack, Skeleton, SkeletonCircle, Table, type SystemStyleObject} from '@chakra-ui/react'

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

// One object per kind of cell, shared by every row, so the style engine
// resolves each once and finds it in its cache for every cell after that.
const FIRST_CELL: SystemStyleObject = {verticalAlign: 'middle', position: 'relative', _before: stripe('start')}
const CELL: SystemStyleObject = {verticalAlign: 'middle'}
const LAST_CELL: SystemStyleObject = {verticalAlign: 'middle', position: 'relative', _after: stripe('end')}
const ONLY_CELL: SystemStyleObject = {...LAST_CELL, _before: stripe('start')}
const DAY_CELL: SystemStyleObject = {py: '1.5', position: 'relative', _before: stripe('start'), _after: stripe('end')}

/** The block of one cell: its width from the row and the column, as an inline style. */
const blockStyle = (row: number, col: number, column: SkeletonColumn): CSSProperties => ({
  width: `${Math.round((WIDTHS[(row + col) % WIDTHS.length] ?? 0.6) * 100)}%`,
  maxWidth: `${Math.round(column.width * 0.9)}px`,
  ...(column.align === 'end' ? {marginInlineStart: 'auto'} : {})
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
    <Table.ScrollArea borderWidth="1px" rounded="surface" bg="bg.surface" data-skeleton="table" aria-busy="true">
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
              <Table.Cell colSpan={columns.length + 1} css={DAY_CELL}>
                <Skeleton h="4" rounded="sm" style={{width: 144}} />
              </Table.Cell>
            </Table.Row>
          )}
          {Array.from({length: rows}, (_, r) => (
            <Table.Row key={r}>
              {columns.map((c, i) => (
                <Table.Cell key={c.id} style={{width: c.width}} css={i === 0 ? FIRST_CELL : CELL}>
                  {i === 0 && avatar ? (
                    <HStack gap="3">
                      <SkeletonCircle size="8" flexShrink={0} />
                      <Skeleton h="4" rounded="sm" style={blockStyle(r, i, c)} />
                    </HStack>
                  ) : (
                    <Skeleton h="4" rounded="sm" style={blockStyle(r, i, c)} />
                  )}
                </Table.Cell>
              ))}
              <Table.Cell style={{width: actionsWidth}} css={columns.length === 0 ? ONLY_CELL : LAST_CELL}>
                <Skeleton h="4" rounded="sm" style={{width: 48}} />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Table.ScrollArea>
  )
}
