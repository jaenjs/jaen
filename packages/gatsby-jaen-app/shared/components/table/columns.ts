/**
 * What a screen tells DataTable about its columns, and the layout a person
 * makes of them.
 *
 * A column is an id, the header word in the account's language, the width
 * the table reserves for it, and the cell. The layout is the order and the
 * visibility of those ids, remembered per table id in localStorage under
 * `taxi-app.<tableId>.columns`, the key the board used before there was a
 * shared table, so a dispatcher's saved layout survives the port.
 */
import type {ReactNode} from 'react'

export interface DataColumn<Row> {
  id: string
  /** The header word, already in the account's language. */
  label: string
  /** Pixels. The table's minimum width is the sum of the visible columns. */
  width: number
  cell: (row: Row) => ReactNode
  /** Shown before anybody hides it. Default true. */
  defaultVisible?: boolean
  /** Numbers sit on the right. */
  align?: 'start' | 'end'
}

export interface ColumnLayout {
  id: string
  visible: boolean
}

export const defaultLayout = <Row>(columns: DataColumn<Row>[]): ColumnLayout[] =>
  columns.map(c => ({id: c.id, visible: c.defaultVisible ?? true}))

const storageKey = (tableId: string) => `taxi-app.${tableId}.columns`

/**
 * The saved layout, or the default. Storage may be missing or throw, then the
 * default. A column added since the layout was saved is appended with its
 * default, one that no longer exists is dropped.
 */
export const loadLayout = <Row>(tableId: string, columns: DataColumn<Row>[]): ColumnLayout[] => {
  const defaults = defaultLayout(columns)
  try {
    const raw = window.localStorage.getItem(storageKey(tableId))
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as ColumnLayout[]
    if (!Array.isArray(parsed)) return defaults
    const known = new Set(defaults.map(c => c.id))
    const kept = parsed.filter(c => c && typeof c.id === 'string' && known.has(c.id)).map(c => ({id: c.id, visible: c.visible !== false}))
    defaults.forEach(c => {
      if (!kept.some(k => k.id === c.id)) kept.push(c)
    })
    return kept
  } catch {
    return defaults
  }
}

export const saveLayout = (tableId: string, layout: ColumnLayout[]) => {
  try {
    window.localStorage.setItem(storageKey(tableId), JSON.stringify(layout))
  } catch {
    /* a browser that blocks storage keeps the layout for the tab only */
  }
}
