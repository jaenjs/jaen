import React, { useState, useRef, useEffect } from 'react'
import { useI18nCode } from '../i18n'
import { getI18nCommon } from '../locales/i18nCommon'

// --------------- Utility ---------------

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function formatDateDisplay(date: string | Date): string {
  if (typeof date === 'string') {
    const parts = date.split('-')
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`
    return date
  }
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}.${date.getFullYear()}`
}

export function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatPrice(price: number | undefined): string {
  if (price == null) return '-'
  return `€ ${price.toFixed(2)}`
}

// --------------- Icons ---------------

export function IconCheck({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 6 9 17l-5-5" /></svg>
}
export function IconX({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
}
export function IconSearch({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
}
export function IconCalendar({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></svg>
}
export function IconClock({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
}
export function IconChevronLeft({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m15 18-6-6 6-6" /></svg>
}
export function IconChevronRight({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m9 18 6-6-6-6" /></svg>
}
export function IconChevronDown({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6" /></svg>
}
export function IconArrowUpDown({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" /></svg>
}
export function IconSettings2({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></svg>
}
export function IconRotateCcw({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
}
export function IconGripVertical({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" /></svg>
}
export function IconUsers({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}
export function IconMapPin({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></svg>
}
export function IconTriangleAlert({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
}
export function IconLoader({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cx('animate-spin', className)}><path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" /><path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m4.9 19.1 2.9-2.9" /><path d="M2 12h4" /><path d="m4.9 4.9 2.9 2.9" /></svg>
}
export function IconBriefcase({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><rect width="20" height="14" x="2" y="6" rx="2" /></svg>
}
export function IconPlane({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>
}
export function IconCar({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></svg>
}
export function IconArrowLeft({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
}
export function IconRefresh({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
}
export function IconPlus({ className = '' }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14" /><path d="M12 5v14" /></svg>
}

// --------------- Status Pill ---------------

type TransferStatus = string

export function StatusPill({ status }: { status: TransferStatus }) {
  const code = useI18nCode()
  const { strings: tc } = getI18nCommon(code)
  const s = status?.toLowerCase?.() ?? ''
  if (s === 'completed') {
    return <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-success/10 text-success border-success/20">{tc.StatusCompleted}</div>
  }
  if (s === 'planned' || s === 'pending') {
    return <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground border-border">{tc.StatusPlanned}</div>
  }
  if (s === 'cancelled' || s === 'canceled' || s === 'terminated') {
    return <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-destructive/10 text-destructive border-destructive/20">{tc.StatusCancelled}</div>
  }
  if (s === 'in_progress' || s === 'in progress' || s === 'active') {
    return <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-warning/10 text-warning border-warning/20">{tc.StatusInProgress}</div>
  }
  return <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground border-border">{status}</div>
}

// --------------- Column Customization ---------------

export type ColumnConfig = {
  id: string
  label: string
  visible: boolean
}

export function ColumnPopover({
  columns,
  onColumnsChange,
  onReset,
  open,
  onOpenChange,
}: {
  columns: ColumnConfig[]
  onColumnsChange: (columns: ColumnConfig[]) => void
  onReset: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const code = useI18nCode()
  const { strings: tc } = getI18nCommon(code)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        onOpenChange(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, onOpenChange])

  const handleToggle = (id: string) => {
    onColumnsChange(columns.map(col => col.id === id ? { ...col, visible: !col.visible } : col))
  }

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) return
    const draggedIdx = columns.findIndex(c => c.id === draggedId)
    const targetIdx = columns.findIndex(c => c.id === targetId)
    if (draggedIdx === -1 || targetIdx === -1) return
    const next = [...columns]
    const [removed] = next.splice(draggedIdx, 1)
    if (removed) next.splice(targetIdx, 0, removed)
    onColumnsChange(next)
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium border border-input rounded-md px-3 h-8 gap-1.5 bg-background hover:bg-muted hover:text-foreground shadow-sm transition-colors"
        onClick={() => onOpenChange(!open)}
      >
        <IconSettings2 className="h-4 w-4" />
        <span className="hidden sm:inline">{tc.ColumnsLabel}</span>
      </button>
      {open && (
        <div
          ref={popoverRef}
          className="z-[100] rounded-md border bg-card text-card-foreground shadow-lg w-64 p-0 absolute right-0 top-full mt-2"
        >
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{tc.ColumnsCustomize}</span>
              <button className="hover:bg-accent hover:text-accent-foreground rounded-md h-7 px-2 text-xs gap-1 inline-flex items-center" onClick={onReset}>
                <IconRotateCcw className="h-3 w-3" /> {tc.ColumnsReset}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{tc.ColumnsDragHint}</p>
          </div>
          <div className="p-2 max-h-[300px] overflow-y-auto">
            {columns.map(col => (
              <div
                key={col.id}
                draggable
                className={cx(
                  'flex items-center gap-2 p-2 rounded-md cursor-move transition-all hover:bg-muted/50',
                  draggedId === col.id && 'opacity-50'
                )}
                onDragStart={() => setDraggedId(col.id)}
                onDragOver={e => handleDragOver(e, col.id)}
                onDragEnd={() => setDraggedId(null)}
              >
                <IconGripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={col.visible}
                  data-state={col.visible ? 'checked' : 'unchecked'}
                  className="h-4 w-4 shrink-0 rounded-sm border border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex items-center justify-center"
                  onClick={() => handleToggle(col.id)}
                >
                  {col.visible && <IconCheck className="h-3 w-3" />}
                </button>
                <label className="text-sm flex-1 cursor-pointer select-none" onClick={() => handleToggle(col.id)}>
                  {col.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// --------------- Sort Dropdown ---------------

export type SortOrder = 'earliest' | 'latest'

export function SortDropdown({
  value,
  onChange,
}: {
  value: SortOrder
  onChange: (v: SortOrder) => void
}) {
  const code = useI18nCode()
  const { strings: tc } = getI18nCommon(code)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm bg-card w-full md:w-[200px] h-9"
        onClick={() => setOpen(!open)}
      >
        <IconArrowUpDown className="h-4 w-4 mr-2" />
        <span>{value === 'earliest' ? tc.SortEarliest : tc.SortLatest}</span>
        <IconChevronDown className="h-4 w-4 opacity-50" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-full min-w-[8rem] rounded-md border bg-background shadow-md">
          <div className="p-1">
            {(['earliest', 'latest'] as SortOrder[]).map(opt => (
              <div
                key={opt}
                className={cx(
                  'relative flex w-full cursor-pointer items-center rounded-sm py-1.5 pl-8 pr-2 text-sm hover:bg-accent hover:text-accent-foreground',
                  value === opt && 'bg-accent/50'
                )}
                onClick={() => { onChange(opt); setOpen(false) }}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  {value === opt && <IconCheck className="h-4 w-4" />}
                </span>
                {opt === 'earliest' ? tc.SortEarliest : tc.SortLatest}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// --------------- Date Filter ---------------

export type DateFilterValue = 'today' | 'tomorrow' | 'all' | 'custom'

export function DateFilter({
  value,
  onChange,
  customRange,
  onCustomRangeChange,
}: {
  value: DateFilterValue
  onChange: (v: DateFilterValue) => void
  customRange: { start: Date | null; end: Date | null }
  onCustomRangeChange: (r: { start: Date | null; end: Date | null }) => void
}) {
  const code = useI18nCode()
  const { strings: tc } = getI18nCommon(code)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false)
    }
    if (pickerOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  const btnClass = (active: boolean) => cx(
    'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium h-9 px-3 flex-1 rounded-none first:rounded-l-md border-r border-border transition-colors',
    active ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:text-accent-foreground hover:bg-accent'
  )

  return (
    <div className="w-full md:w-auto">
      <div className="flex w-full h-9 rounded-md shadow-sm border border-border bg-background" role="group">
        <button className={btnClass(value === 'today')} onClick={() => { onChange('today'); onCustomRangeChange({ start: null, end: null }) }}>{tc.DateToday}</button>
        <button className={btnClass(value === 'tomorrow')} onClick={() => { onChange('tomorrow'); onCustomRangeChange({ start: null, end: null }) }}>{tc.DateTomorrow}</button>
        <button className={btnClass(value === 'all')} onClick={() => { onChange('all'); onCustomRangeChange({ start: null, end: null }) }}>{tc.DateAll}</button>
        <div className="relative flex-1" ref={pickerRef}>
          <button
            className={cx(
              'inline-flex items-center gap-2 whitespace-nowrap text-sm h-9 px-3 w-full rounded-none last:rounded-r-md justify-start text-left font-normal transition-colors',
              value === 'custom' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:text-accent-foreground hover:bg-accent'
            )}
            onClick={() => setPickerOpen(!pickerOpen)}
          >
            <IconCalendar className="mr-2 h-4 w-4" />
            {value === 'custom' && customRange.start && customRange.end
              ? `${formatDateDisplay(customRange.start)} - ${formatDateDisplay(customRange.end)}`
              : tc.DateCustom}
          </button>
          {pickerOpen && (
            <div className="absolute top-full left-0 mt-1 z-[100] rounded-md bg-background shadow-lg p-3">
              <CalendarPicker
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                range={customRange}
                onRangeChange={r => {
                  onCustomRangeChange(r)
                  if (r.start && r.end) {
                    onChange('custom')
                    setPickerOpen(false)
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CalendarPicker({
  month,
  onMonthChange,
  range,
  onRangeChange,
}: {
  month: Date
  onMonthChange: (d: Date) => void
  range: { start: Date | null; end: Date | null }
  onRangeChange: (r: { start: Date | null; end: Date | null }) => void
}) {
  const calCode = useI18nCode()
  const { strings: tc } = getI18nCommon(calCode)
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstDay = new Date(year, m, 1)
  const lastDay = new Date(year, m + 1, 0)
  const startPad = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)

  const weeks: Date[][] = []
  let week: Date[] = []
  for (let i = 0; i < startPad; i++) week.push(new Date(year, m, -startPad + i + 1))
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(new Date(year, m, d))
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) {
    let next = 1
    while (week.length < 7) week.push(new Date(year, m + 1, next++))
    weeks.push(week)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center pt-1 relative items-center">
        <div className="text-sm font-medium">
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <button className="absolute left-1 border border-input hover:bg-accent h-7 w-7 rounded-md flex items-center justify-center opacity-50 hover:opacity-100" onClick={() => { const n = new Date(month); n.setMonth(n.getMonth() - 1); onMonthChange(n) }}>
          <IconChevronLeft className="h-4 w-4" />
        </button>
        <button className="absolute right-1 border border-input hover:bg-accent h-7 w-7 rounded-md flex items-center justify-center opacity-50 hover:opacity-100" onClick={() => { const n = new Date(month); n.setMonth(n.getMonth() + 1); onMonthChange(n) }}>
          <IconChevronRight className="h-4 w-4" />
        </button>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="flex">
            {[tc.WeekdaySu, tc.WeekdayMo, tc.WeekdayTu, tc.WeekdayWe, tc.WeekdayTh, tc.WeekdayFr, tc.WeekdaySa].map(d => (
              <th key={d} className="text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((wk, wi) => (
            <tr key={wi} className="flex w-full mt-2">
              {wk.map((date, di) => {
                const isCurrentMonth = date.getMonth() === m
                const isToday = date.toDateString() === todayDate.toDateString()
                const isSelected = (range.start && date.toDateString() === range.start.toDateString()) || (range.end && date.toDateString() === range.end.toDateString())
                const isInRange = range.start && range.end && date > range.start && date < range.end
                return (
                  <td key={di} className={cx('h-9 w-9 text-center text-sm p-0 relative', isInRange && 'bg-accent/30')}>
                    <button
                      className={cx(
                        'inline-flex items-center justify-center rounded-md text-sm h-9 w-9 p-0 font-normal transition-colors hover:bg-accent hover:text-accent-foreground',
                        !isCurrentMonth && 'text-muted-foreground opacity-50',
                        isToday && 'ring-1 ring-primary/30 font-medium',
                        isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90'
                      )}
                      onClick={() => {
                        if (!range.start || (range.start && range.end)) {
                          onRangeChange({ start: date, end: null })
                        } else if (date < range.start) {
                          onRangeChange({ start: date, end: range.start })
                        } else {
                          onRangeChange({ ...range, end: date })
                        }
                      }}
                    >
                      {date.getDate()}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --------------- Status Filter ---------------

const ALL_STATUSES = ['Completed', 'Planned', 'In Progress', 'Cancelled']

export function StatusFilter({
  selected,
  onChange,
}: {
  selected: Set<string>
  onChange: (s: Set<string>) => void
}) {
  const code = useI18nCode()
  const { strings: tc } = getI18nCommon(code)
  const statusLabels: Record<string, string> = {
    Completed: tc.StatusCompleted,
    Planned: tc.StatusPlanned,
    'In Progress': tc.StatusInProgress,
    Cancelled: tc.StatusCancelled,
  }
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const activeCount = selected.size

  return (
    <div className="relative">
      <button
        ref={btnRef}
        className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium border border-input rounded-md px-3 h-9 gap-1.5 bg-background hover:bg-muted shadow-sm transition-colors"
        onClick={() => setOpen(!open)}
      >
        {tc.StatusLabel}
        {activeCount < ALL_STATUSES.length && (
          <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">{activeCount}</span>
        )}
      </button>
      {open && (
        <div ref={ref} className="absolute top-full left-0 mt-1 z-[100] rounded-md border bg-card shadow-lg w-48 p-2">
          {ALL_STATUSES.map(status => {
            const isChecked = selected.has(status)
            return (
              <div
                key={status}
                className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  const next = new Set(selected)
                  if (isChecked) next.delete(status); else next.add(status)
                  onChange(next)
                }}
              >
                <div className={cx(
                  'h-4 w-4 rounded-sm border flex items-center justify-center',
                  isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                )}>
                  {isChecked && <IconCheck className="h-3 w-3" />}
                </div>
                <span className="text-sm">{statusLabels[status] || status}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --------------- Pagination ---------------

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  onPageChange: (p: number) => void
}) {
  const pCode = useI18nCode()
  const { strings: tc } = getI18nCommon(pCode)
  if (totalPages <= 1) return null

  const pageBtnClass = (active: boolean) => cx(
    'inline-flex items-center justify-center text-sm font-medium h-9 rounded-md px-3 transition-colors',
    active ? 'bg-primary text-primary-foreground' : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
  )

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        className="inline-flex items-center justify-center text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3 disabled:opacity-50"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        {tc.Previous}
      </button>
      <div className="hidden sm:flex gap-1 items-center">
        <button className={pageBtnClass(currentPage === 1)} onClick={() => onPageChange(1)}>1</button>
        {currentPage > 3 && totalPages > 3 && <span className="px-2 text-muted-foreground">...</span>}
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p !== 1 && p !== totalPages && (totalPages <= 5 || Math.abs(p - currentPage) <= 1))
          .map(p => <button key={p} className={pageBtnClass(currentPage === p)} onClick={() => onPageChange(p)}>{p}</button>)}
        {currentPage < totalPages - 2 && totalPages > 3 && <span className="px-2 text-muted-foreground">...</span>}
        {totalPages > 1 && <button className={pageBtnClass(currentPage === totalPages)} onClick={() => onPageChange(totalPages)}>{totalPages}</button>}
      </div>
      <span className="sm:hidden text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
      <button
        className="inline-flex items-center justify-center text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3 disabled:opacity-50"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        {tc.Next}
      </button>
    </div>
  )
}

// --------------- Cursor Pagination ---------------

export function CursorPagination({
  currentPage,
  totalPages,
  totalCount,
  hasNextPage,
  hasPreviousPage,
  onNext,
  onPrev,
  onFirst,
}: {
  currentPage: number
  totalPages: number
  totalCount: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  onNext: () => void
  onPrev: () => void
  onFirst?: () => void
}) {
  const cpCode = useI18nCode()
  const { strings: tc } = getI18nCommon(cpCode)
  if (totalPages <= 1) return null

  const btnClass = 'inline-flex items-center justify-center text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3 disabled:opacity-50 transition-colors'
  const activeBtnClass = 'inline-flex items-center justify-center text-sm font-medium h-9 rounded-md px-3 bg-primary text-primary-foreground transition-colors'

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button className={btnClass} disabled={!hasPreviousPage} onClick={onPrev}>
        {tc.Previous}
      </button>
      {onFirst && currentPage > 2 && (
        <button className={btnClass} onClick={onFirst}>1</button>
      )}
      {currentPage > 2 && <span className="px-1 text-muted-foreground">...</span>}
      <button className={activeBtnClass}>{currentPage}</button>
      {currentPage < totalPages && <span className="px-1 text-muted-foreground">...</span>}
      <span className="text-sm text-muted-foreground px-1">{tc.PaginationOf.replace('{totalPages}', String(totalPages)).replace('{totalCount}', String(totalCount))}</span>
      <button className={btnClass} disabled={!hasNextPage} onClick={onNext}>
        {tc.Next}
      </button>
    </div>
  )
}

// --------------- Loading Overlay ---------------

export function LoadingOverlay() {
  const loCode = useI18nCode()
  const { strings: tc } = getI18nCommon(loCode)
  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center pt-16 bg-background/80 backdrop-blur-sm rounded-lg">
      <div className="flex items-center gap-2 text-muted-foreground">
        <IconLoader className="h-5 w-5" />
        <span className="text-sm font-medium">{tc.Loading}</span>
      </div>
    </div>
  )
}

// --------------- Empty State ---------------

export function EmptyState({ message = 'No data found' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <IconSearch className="h-8 w-8 opacity-40" />
      </div>
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
}

// --------------- Error Banner ---------------

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
      <IconTriangleAlert className="h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  )
}

// --------------- Date Group Header ---------------

export function DateGroupHeader({ dateStr, today, tomorrow }: { dateStr: string; today: string; tomorrow: string }) {
  const color = dateStr === today ? 'text-success' : dateStr === tomorrow ? 'text-warning' : 'text-muted-foreground'
  const lineColor = dateStr === today ? 'bg-success' : dateStr === tomorrow ? 'bg-warning' : 'bg-border'

  return (
    <div className="flex items-center gap-2 py-2">
      <div className={cx('flex-1 h-0.5 rounded', lineColor)} />
      <span className={cx('text-sm font-semibold whitespace-nowrap', color)}>
        {formatDateHeader(dateStr)}
      </span>
      <div className={cx('flex-1 h-0.5 rounded', lineColor)} />
    </div>
  )
}

