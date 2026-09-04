import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { MOCK_TRANSFERS } from '../fixtures/transfers'

vi.mock('../../shared/client', () => ({
  resolve: vi.fn(),
  client: {},
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  schema: {},
}))

import { useTransfers } from '../../shared/hooks'
import { resolve } from '../../shared/client'

const mockResolve = vi.mocked(resolve)

function makeConnection(items: any[], hasNextPage = false, endCursor: string | null = null, totalCount?: number) {
  return {
    edges: items.map(t => ({ node: t })),
    pageInfo: { endCursor, hasNextPage, hasPreviousPage: false, startCursor: null },
    totalCount: totalCount ?? items.length,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useTransfers (paginated)', () => {
  it('sets isLoading to true initially', () => {
    mockResolve.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useTransfers(10))
    expect(result.current.isLoading).toBe(true)
    expect(result.current.transfers).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('fetches the first page and returns transfer data', async () => {
    const page1 = MOCK_TRANSFERS.slice(0, 3)
    mockResolve.mockResolvedValue(makeConnection(page1, false, null, 3))

    const { result } = renderHook(() => useTransfers(10))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.transfers.length).toBe(3)
    expect(result.current.error).toBeNull()
    expect(result.current.pagination.totalCount).toBe(3)
    expect(result.current.pagination.currentPage).toBe(1)
    expect(result.current.pagination.hasNextPage).toBe(false)
    expect(mockResolve).toHaveBeenCalledTimes(1)
  })

  it('sets error state on failure', async () => {
    mockResolve.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useTransfers(10))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Network error')
    expect(result.current.transfers).toEqual([])
  })

  it('navigates to the next page via nextPage()', async () => {
    const page1 = MOCK_TRANSFERS.slice(0, 2)
    const page2 = MOCK_TRANSFERS.slice(2, 4)

    mockResolve
      .mockResolvedValueOnce(makeConnection(page1, true, 'cursor-after-2', 6))
      .mockResolvedValueOnce(makeConnection(page2, false, null, 6))

    const { result } = renderHook(() => useTransfers(2))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.transfers.length).toBe(2)
    expect(result.current.pagination.currentPage).toBe(1)
    expect(result.current.pagination.hasNextPage).toBe(true)

    act(() => {
      result.current.nextPage()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.pagination.currentPage).toBe(2)
    expect(result.current.transfers.length).toBe(2)
    expect(mockResolve).toHaveBeenCalledTimes(2)
  })

  it('navigates back to previous page via prevPage()', async () => {
    const page1 = MOCK_TRANSFERS.slice(0, 2)
    const page2 = MOCK_TRANSFERS.slice(2, 4)

    mockResolve
      .mockResolvedValueOnce(makeConnection(page1, true, 'cursor-after-2', 6))
      .mockResolvedValueOnce(makeConnection(page2, false, null, 6))
      .mockResolvedValueOnce(makeConnection(page1, true, 'cursor-after-2', 6))

    const { result } = renderHook(() => useTransfers(2))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.nextPage() })
    await waitFor(() => expect(result.current.pagination.currentPage).toBe(2))

    act(() => { result.current.prevPage() })
    await waitFor(() => expect(result.current.pagination.currentPage).toBe(1))

    expect(mockResolve).toHaveBeenCalledTimes(3)
  })

  it('goToPage(1) resets to first page', async () => {
    mockResolve
      .mockResolvedValueOnce(makeConnection(MOCK_TRANSFERS.slice(0, 2), true, 'c1', 6))
      .mockResolvedValueOnce(makeConnection(MOCK_TRANSFERS.slice(2, 4), true, 'c2', 6))
      .mockResolvedValueOnce(makeConnection(MOCK_TRANSFERS.slice(0, 2), true, 'c1', 6))

    const { result } = renderHook(() => useTransfers(2))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.nextPage() })
    await waitFor(() => expect(result.current.pagination.currentPage).toBe(2))

    act(() => { result.current.goToPage(1) })
    await waitFor(() => expect(result.current.pagination.currentPage).toBe(1))

    expect(mockResolve).toHaveBeenCalledTimes(3)
  })

  it('computes totalPages from totalCount and pageSize', async () => {
    mockResolve.mockResolvedValue(makeConnection(MOCK_TRANSFERS.slice(0, 5), true, 'c1', 23))

    const { result } = renderHook(() => useTransfers(5))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.pagination.totalPages).toBe(5)
    expect(result.current.pagination.totalCount).toBe(23)
  })

  it('provides a refetch function that re-fetches the current page', async () => {
    mockResolve.mockResolvedValue(makeConnection([], false, null, 0))

    const { result } = renderHook(() => useTransfers(10))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(typeof result.current.refetch).toBe('function')

    mockResolve.mockResolvedValue(makeConnection(MOCK_TRANSFERS.slice(0, 2), false, null, 2))
    act(() => { result.current.refetch() })

    await waitFor(() => {
      expect(result.current.transfers.length).toBe(2)
    })

    expect(mockResolve).toHaveBeenCalledTimes(2)
  })

  it('does not navigate past the last page', async () => {
    mockResolve.mockResolvedValue(makeConnection(MOCK_TRANSFERS.slice(0, 2), false, null, 2))

    const { result } = renderHook(() => useTransfers(10))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.pagination.hasNextPage).toBe(false)

    act(() => { result.current.nextPage() })

    // Should still be on page 1 (no additional call)
    expect(result.current.pagination.currentPage).toBe(1)
    expect(mockResolve).toHaveBeenCalledTimes(1)
  })

  it('does not navigate before page 1', async () => {
    mockResolve.mockResolvedValue(makeConnection(MOCK_TRANSFERS.slice(0, 2), true, 'c1', 4))

    const { result } = renderHook(() => useTransfers(2))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.prevPage() })

    expect(result.current.pagination.currentPage).toBe(1)
    expect(mockResolve).toHaveBeenCalledTimes(1)
  })
})
