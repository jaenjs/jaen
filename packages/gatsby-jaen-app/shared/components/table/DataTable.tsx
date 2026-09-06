/**
 * One table for every list screen, drawn the way the dispatcher's board
 * always was (okf/architecture/data-layer.md).
 *
 * TanStack Table is the engine and draws nothing: it owns the column order
 * and visibility, the grouping into days and the row model. The Chakra
 * design around it is the board's, byte for byte: the header row on
 * `bg.subtle`, one day header row per group with the date's tone as
 * background and on its right edge, the two 4px stripes on every row (the
 * LEFT edge is WHO, the driver's colour, the RIGHT edge is WHEN, green today
 * and yellow tomorrow, see dispatch.md "The two stripes"), the Details
 * button as the last column, cards below `md`, the column popover with drag
 * order, visibility and reset remembered per table id, and the pager.
 *
 * The screen brings the columns (`DataColumn`, the header word already in
 * the account's language), the rows it filtered and sorted, and the rules:
 * which key groups a row into a day and what that day is called, which
 * colour sits on the left, which row is drawn faded, what a card looks like.
 * The component draws the count line, the error banner, the loading
 * overlay, the empty state, the table or the cards, and the pager, in that
 * order, into the screen's Stack, exactly where the board had them.
 */
import React, {useEffect, useMemo, useState, type ReactNode} from 'react'
import {Box, Button, HStack, Table, Text} from '@chakra-ui/react'
import {
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  useReactTable,
  type ColumnDef
} from '@tanstack/react-table'
import {useI18nCode} from '../../i18n'
import {getI18nCommon} from '../../locales/i18nCommon'
import {ErrorBanner} from '../ErrorBanner'
import {LoadingOverlay} from '../LoadingOverlay'
import {loadLayout, saveLayout, defaultLayout, type ColumnLayout, type DataColumn} from './columns'
import {ColumnsPopover} from './ColumnsPopover'
import {DataCards, DefaultCard, type CardApi, type DayTone, type Section} from './DataCards'
import {Pager, type PagerProps} from './Pager'
import {useIsMobile} from './useIsMobile'

/** The grouping column, never drawn: its value is the day a row belongs to. */
const GROUP = '__group'

/** The Details column on the right, the same 72px on every table. */
const ACTIONS_WIDTH = 72

export interface DataGroup<Row> {
  /** The key rows are grouped by, in the order the rows arrive. */
  key: (row: Row) => string
  /** The header's words for a key. */
  label: (key: string) => string
  /** The tone of a key: green today, yellow tomorrow, nothing otherwise. */
  tone?: (key: string) => DayTone
}

export interface DataTableProps<Row> {
  /** The layout's key in localStorage, `transfers` is the board's old one. */
  tableId: string
  columns: DataColumn<Row>[]
  /** Filtered and sorted by the screen, in the order they are drawn. */
  rows: Row[]
  rowId: (row: Row) => string
  /** A row or a card, or its Details button, opens the row. */
  onOpen: (row: Row) => void
  /** Day header rows and the right stripe. Without it the rows are flat. */
  group?: DataGroup<Row>
  /** WHO: the colour on the left edge of a row and a card. */
  stripe?: (row: Row) => string | undefined
  /** A row drawn at 0.7, the completed ride. */
  muted?: (row: Row) => boolean
  /** The card below `md`. DefaultCard from the visible columns otherwise. */
  card?: (row: Row, api: CardApi) => ReactNode
  /** Cards at every width, the driver's list on a desk as well. */
  cardsOnly?: boolean
  /** The count line, left of the column popover. */
  summary?: string
  /** The column popover on the count line. Default on, never below `md`. */
  columnsControl?: boolean
  /** The word on the last column's button, `Details` unless the screen says. */
  actionLabel?: string
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  /** What is drawn instead of the table when there are no rows. */
  empty?: ReactNode
  /** The pager, drawn when there is more than one page, always with `always`. */
  pager?: PagerProps & {always?: boolean}
}

export function DataTable<Row>({
  tableId,
  columns,
  rows,
  rowId,
  onOpen,
  group,
  stripe,
  muted,
  card,
  cardsOnly = false,
  summary,
  columnsControl = true,
  actionLabel,
  isLoading = false,
  error,
  onRetry,
  empty,
  pager
}: DataTableProps<Row>) {
  const code = useI18nCode()
  const {strings: tc} = getI18nCommon(code)
  const mobile = useIsMobile()

  // The layout, remembered per browser: the default on the server and on the
  // first client render so the two agree, the saved one after mount.
  const [layout, setLayout] = useState<ColumnLayout[]>(() => defaultLayout(columns))
  useEffect(() => {
    setLayout(loadLayout(tableId, columns))
    // The columns' ids are what the layout is made of, their cells may change freely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, columns.map(c => c.id).join(',')])
  const changeLayout = (next: ColumnLayout[]) => {
    setLayout(next)
    saveLayout(tableId, next)
  }

  const byId = useMemo(() => new Map(columns.map(c => [c.id, c])), [columns])

  const defs = useMemo<ColumnDef<Row>[]>(() => {
    const own: ColumnDef<Row>[] = columns.map(c => ({id: c.id}))
    if (group) own.push({id: GROUP, accessorFn: row => group.key(row)})
    return own
  }, [columns, group])

  const columnOrder = useMemo(() => layout.map(l => l.id), [layout])
  const columnVisibility = useMemo(() => Object.fromEntries(layout.map(l => [l.id, l.visible])), [layout])
  const grouping = useMemo(() => (group ? [GROUP] : []), [group])

  const table = useReactTable<Row>({
    data: rows,
    columns: defs,
    state: {columnOrder, columnVisibility, grouping, expanded: true},
    getRowId: row => rowId(row),
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    // The grouping column stays where it is, which is nowhere on the screen.
    groupedColumnMode: false
  })

  // The visible columns in the person's order, the grouping column left out.
  const visible = table
    .getVisibleLeafColumns()
    .map(c => byId.get(c.id))
    .filter((c): c is DataColumn<Row> => !!c)
  const minWidth = visible.reduce((sum, c) => sum + c.width, ACTIONS_WIDTH)

  // The row model as sections: a header row per group, then its rows. Flat
  // rows are one section without a header.
  const sections: Section<Row>[] = []
  if (group) {
    table.getRowModel().rows.forEach(r => {
      if (r.getIsGrouped()) {
        const key = String(r.getValue(GROUP) ?? '')
        sections.push({key, tone: group.tone?.(key), rows: []})
      } else {
        const last = sections[sections.length - 1]
        if (last) last.rows.push(r.original)
        else sections.push({key: '', tone: undefined, rows: [r.original]})
      }
    })
  } else {
    sections.push({key: '', tone: undefined, rows: table.getRowModel().rows.map(r => r.original)})
  }

  const showEmpty = !isLoading && rows.length === 0 && empty != null
  const showControl = columnsControl && !mobile
  const showPager = !!pager && (pager.always || pager.hasNext || pager.page > 1)
  const details = actionLabel ?? tc.Details

  const renderCard =
    card ??
    ((row: Row, api: CardApi) => (
      <DefaultCard row={row} columns={visible} tone={api.tone} stripe={stripe?.(row)} onOpen={onOpen} />
    ))

  return (
    <>
      {(summary !== undefined || showControl) && (
        <HStack justify={summary !== undefined ? 'space-between' : 'flex-end'} flexWrap="wrap" gap="2">
          {summary !== undefined && (
            <Text textStyle="sm" color="fg.muted">
              {summary}
            </Text>
          )}
          {showControl && <ColumnsPopover columns={columns} layout={layout} onChange={changeLayout} />}
        </HStack>
      )}

      {error && <ErrorBanner message={error} onRetry={onRetry} />}

      <Box position="relative" minH="40">
        {isLoading && <LoadingOverlay overlay />}
        {showEmpty ? (
          empty
        ) : mobile || cardsOnly ? (
          <DataCards sections={sections} rowId={rowId} label={group?.label} card={renderCard} />
        ) : (
          <Table.ScrollArea borderWidth="1px" rounded="lg" bg="bg.surface">
            <Table.Root size="sm" variant="line" tableLayout="fixed" style={{minWidth}}>
              <Table.Header>
                <Table.Row bg="bg.subtle">
                  {visible.map(c => (
                    <Table.ColumnHeader
                      key={c.id}
                      style={{width: c.width}}
                      color="fg.muted"
                      whiteSpace="nowrap"
                      textAlign={c.align === 'end' ? 'end' : undefined}>
                      {c.label}
                    </Table.ColumnHeader>
                  ))}
                  <Table.ColumnHeader style={{width: ACTIONS_WIDTH}} />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sections.map(section => {
                  const tone = section.tone
                  return (
                    <React.Fragment key={section.key || 'none'}>
                      {group && (
                        <Table.Row
                          colorPalette={tone}
                          bg={tone ? 'colorPalette.subtle' : 'bg.subtle'}
                          borderInlineStartWidth="4px"
                          borderInlineStartColor="transparent"
                          borderInlineEndWidth="4px"
                          borderInlineEndColor={tone ? 'colorPalette.solid' : 'transparent'}>
                          <Table.Cell colSpan={visible.length + 1} py="1.5">
                            <Text textStyle="sm" fontWeight="semibold" color={tone ? 'colorPalette.fg' : 'fg.muted'}>
                              {group.label(section.key)}
                            </Text>
                          </Table.Cell>
                        </Table.Row>
                      )}
                      {section.rows.map(row => (
                        <Table.Row
                          key={rowId(row)}
                          cursor="pointer"
                          opacity={muted?.(row) ? 0.7 : 1}
                          colorPalette={tone}
                          borderInlineStartWidth="4px"
                          borderInlineStartColor={stripe?.(row) ?? 'transparent'}
                          borderInlineEndWidth="4px"
                          borderInlineEndColor={tone ? 'colorPalette.solid' : 'transparent'}
                          _hover={{bg: 'bg.subtle'}}
                          onClick={() => onOpen(row)}>
                          {visible.map(c => (
                            <Table.Cell
                              key={c.id}
                              verticalAlign="middle"
                              style={{width: c.width}}
                              textAlign={c.align === 'end' ? 'end' : undefined}>
                              {c.cell(row)}
                            </Table.Cell>
                          ))}
                          <Table.Cell verticalAlign="middle" style={{width: ACTIONS_WIDTH}}>
                            <Button
                              size="xs"
                              variant="plain"
                              colorPalette="brand"
                              onClick={e => {
                                e.stopPropagation()
                                onOpen(row)
                              }}>
                              {details}
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </React.Fragment>
                  )
                })}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        )}
      </Box>

      {showPager && pager && (
        <Pager
          page={pager.page}
          pages={pager.pages}
          hasNext={pager.hasNext}
          onFirst={pager.onFirst}
          onPrev={pager.onPrev}
          onNext={pager.onNext}
        />
      )}
    </>
  )
}
