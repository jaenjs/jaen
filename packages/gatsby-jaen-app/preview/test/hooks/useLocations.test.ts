import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { MOCK_LOCATIONS } from '../fixtures/locations'

vi.mock('../../shared/client', () => ({
  resolve: vi.fn(),
  client: {},
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  schema: {},
}))

import { useLocations } from '../../shared/hooks'
import { resolve } from '../../shared/client'

const mockResolve = vi.mocked(resolve)

const driverLocs = MOCK_LOCATIONS.filter(l => l.kind === 'driver')
const customerLocs = MOCK_LOCATIONS.filter(l => l.kind === 'customer')

function makeDriverConnection(items = driverLocs, hasNextPage = false, endCursor: string | null = null, totalCount?: number) {
  return {
    edges: items.map(l => ({
      node: { id: l.id, driverId: l.userId, latitude: l.latitude, longitude: l.longitude, accuracy: l.accuracy, recordedAt: l.recordedAtISO, updatedAt: l.updatedAtISO }
    })),
    pageInfo: { endCursor, hasNextPage },
    totalCount: totalCount ?? items.length,
  }
}

function makeCustomerConnection(items = customerLocs, hasNextPage = false, endCursor: string | null = null, totalCount?: number) {
  return {
    edges: items.map(l => ({
      node: { id: l.id, customerId: l.userId, latitude: l.latitude, longitude: l.longitude, accuracy: l.accuracy, recordedAt: l.recordedAtISO, updatedAt: l.updatedAtISO }
    })),
    pageInfo: { endCursor, hasNextPage },
    totalCount: totalCount ?? items.length,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useLocations (paginated)', () => {
  it('sets isLoading initially', () => {
    mockResolve.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useLocations(20))
    expect(result.current.isLoading).toBe(true)
    expect(result.current.locations).toEqual([])
  })

  it('fetches driver and customer locations on first page', async () => {
    let callCount = 0
    mockResolve.mockImplementation(async () => {
      callCount++
      if (callCount === 1) return makeDriverConnection()
      return makeCustomerConnection()
    })

    const { result } = renderHook(() => useLocations(20))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.locations.length).toBe(5)
    expect(result.current.locations.filter(l => l.kind === 'driver').length).toBe(3)
    expect(result.current.locations.filter(l => l.kind === 'customer').length).toBe(2)
    expect(result.current.error).toBeNull()
    expect(result.current.pagination.totalCount).toBe(5)
    expect(result.current.pagination.currentPage).toBe(1)
  })

  it('handles errors', async () => {
    mockResolve.mockRejectedValue(new Error('Location service down'))

    const { result } = renderHook(() => useLocations(20))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Location service down')
  })

  it('provides a refetch function', async () => {
    let callCount = 0
    mockResolve.mockImplementation(async () => {
      callCount++
      if (callCount % 2 === 1) return makeDriverConnection([], false, null, 0)
      return makeCustomerConnection([], false, null, 0)
    })

    const { result } = renderHook(() => useLocations(20))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(typeof result.current.refetch).toBe('function')
  })

  it('reports hasNextPage when either driver or customer connection has more', async () => {
    let callCount = 0
    mockResolve.mockImplementation(async () => {
      callCount++
      if (callCount === 1) return makeDriverConnection(driverLocs, true, 'driver-cursor-3', 10)
      return makeCustomerConnection(customerLocs, false, null, 2)
    })

    const { result } = renderHook(() => useLocations(3))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.pagination.hasNextPage).toBe(true)
    expect(result.current.pagination.totalCount).toBe(12)
  })

  it('navigates to next page', async () => {
    let callCount = 0
    mockResolve.mockImplementation(async () => {
      callCount++
      if (callCount <= 2) {
        return callCount === 1
          ? makeDriverConnection(driverLocs.slice(0, 2), true, 'dc1', 3)
          : makeCustomerConnection(customerLocs.slice(0, 1), true, 'cc1', 2)
      }
      return callCount === 3
        ? makeDriverConnection(driverLocs.slice(2), false, null, 3)
        : makeCustomerConnection(customerLocs.slice(1), false, null, 2)
    })

    const { result } = renderHook(() => useLocations(3))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.pagination.currentPage).toBe(1)
    expect(result.current.pagination.hasNextPage).toBe(true)

    act(() => { result.current.nextPage() })

    await waitFor(() => expect(result.current.pagination.currentPage).toBe(2))
  })
})
