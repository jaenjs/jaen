/**
 * The dispatcher's numbers, from the one resolver that computes them.
 *
 * `dashboard(args: {month})` is admin only and answers in a single round
 * trip: today's counts, tomorrow's, the month's money and one row per driver.
 * Nothing here is counted in the browser. The old screen filtered the twenty
 * most recent rows and called the result a KPI, see
 * okf/architecture/dashboard.md for why that was a coincidence, not a number.
 *
 * The document is written by hand with the arguments inlined, the way
 * shared/hooks.ts does it: a document that names no input type is valid
 * against whichever pylon build a brand happens to serve.
 */
import { useCallback, useEffect, useState } from 'react'
import { fetchGraphQL } from '../../client/limosen'

export interface DashboardToday {
  rides: number
  unassigned: number
  onTheRoad: number
  waiting: number
  rejected: number
}

export interface DashboardTomorrow {
  rides: number
  unassigned: number
}

export interface DashboardMonth {
  revenue: number
  completed: number
  averageFare: number
  cash: number
  payoutDue: number
  /** A fraction, 0..1. The screen turns it into a percentage. */
  cancellationRate: number
  siteBookings: number
}

export interface DashboardDriver {
  id: string
  name: string
  /** Hex, or undefined when the driver never chose one. */
  color?: string
  completed: number
  revenue: number
  cash: number
  payoutDue: number
}

export interface Dashboard {
  today: DashboardToday
  tomorrow: DashboardTomorrow
  month: DashboardMonth
  drivers: DashboardDriver[]
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** The local calendar date as YYYY-MM-DD. Not toISOString, which is UTC and a day off after 22:00 in Vienna. */
export const localDateISO = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/** The local month as YYYY-MM, the argument the resolver takes. */
export const monthOf = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`

export const shiftMonth = (month: string, by: number): string => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y ?? 1970, (m ?? 1) - 1 + by, 1)
  return monthOf(d)
}

export const tomorrowOf = (d: Date): Date => {
  const t = new Date(d)
  t.setDate(t.getDate() + 1)
  return t
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/**
 * The backend's silver default means "nobody chose a colour" and is mapped to
 * undefined here for the same reason shared/hooks.ts does it: painting every
 * row the same silver says less than painting none of them.
 */
const colourOf = (v: unknown): string | undefined =>
  typeof v === 'string' && v && v.toUpperCase() !== '#C0C0C0' ? v : undefined

const mapDashboard = (raw: any): Dashboard => ({
  today: {
    rides: num(raw?.today?.rides),
    unassigned: num(raw?.today?.unassigned),
    onTheRoad: num(raw?.today?.onTheRoad),
    waiting: num(raw?.today?.waiting),
    rejected: num(raw?.today?.rejected),
  },
  tomorrow: {
    rides: num(raw?.tomorrow?.rides),
    unassigned: num(raw?.tomorrow?.unassigned),
  },
  month: {
    revenue: num(raw?.month?.revenue),
    completed: num(raw?.month?.completed),
    averageFare: num(raw?.month?.averageFare),
    cash: num(raw?.month?.cash),
    payoutDue: num(raw?.month?.payoutDue),
    cancellationRate: num(raw?.month?.cancellationRate),
    siteBookings: num(raw?.month?.siteBookings),
  },
  drivers: (Array.isArray(raw?.drivers) ? raw.drivers : [])
    .filter((d: any) => d && typeof d.id === 'string')
    .map((d: any): DashboardDriver => ({
      id: d.id,
      name: typeof d.name === 'string' && d.name ? d.name : d.id,
      color: colourOf(d.color),
      completed: num(d.completed),
      revenue: num(d.revenue),
      cash: num(d.cash),
      payoutDue: num(d.payoutDue),
    })),
})

const DASHBOARD_SELECTION =
  '{ today { rides unassigned onTheRoad waiting rejected } ' +
  'tomorrow { rides unassigned } ' +
  'month { revenue completed averageFare cash payoutDue cancellationRate siteBookings } ' +
  'drivers { id name color completed revenue cash payoutDue } }'

export async function fetchDashboard(month: string): Promise<Dashboard> {
  const result: any = await fetchGraphQL(
    {
      query: `query { dashboard(args: {month: ${JSON.stringify(month)}}) ${DASHBOARD_SELECTION} }`,
      variables: undefined,
      operationName: undefined,
    },
    {}
  )

  if (result?.errors?.length) {
    throw new Error(String(result.errors[0]?.message || 'GraphQL error'))
  }

  return mapDashboard(result?.data?.dashboard)
}

/**
 * The numbers for one month. `month` is YYYY-MM and defaults to the current
 * one, today and tomorrow are always the calendar's today and tomorrow no
 * matter which month is being looked at.
 */
export function useDashboard(month: string) {
  const [data, setData] = useState<Dashboard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await fetchDashboard(month))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  return { data, isLoading, error, refetch: load }
}
