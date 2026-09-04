import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { MOCK_USERS } from '../fixtures/users'

vi.mock('../../shared/client', () => ({
  resolve: vi.fn(),
  client: {},
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  schema: {},
}))

import { useUsers } from '../../shared/hooks'
import { resolve } from '../../shared/client'

const mockResolve = vi.mocked(resolve)

function makeConnection(items: any[], hasNextPage = false, endCursor: string | null = null, totalCount?: number) {
  return {
    edges: items.map(u => ({ node: u })),
    pageInfo: { endCursor, hasNextPage, hasPreviousPage: false, startCursor: null },
    totalCount: totalCount ?? items.length,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useUsers (paginated)', () => {
  it('sets isLoading to true initially', () => {
    mockResolve.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useUsers(10))
    expect(result.current.isLoading).toBe(true)
    expect(result.current.users).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('fetches the first page and returns user data', async () => {
    mockResolve.mockResolvedValue(makeConnection(MOCK_USERS.slice(0, 3), false, null, 3))

    const { result } = renderHook(() => useUsers(10))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.users.length).toBe(3)
    expect(result.current.error).toBeNull()
    expect(result.current.pagination.totalCount).toBe(3)
    expect(result.current.pagination.currentPage).toBe(1)
  })

  it('sets error state on failure', async () => {
    mockResolve.mockRejectedValue(new Error('IAM unavailable'))

    const { result } = renderHook(() => useUsers(10))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('IAM unavailable')
    expect(result.current.users).toEqual([])
  })

  it('navigates to next page and back', async () => {
    const page1 = MOCK_USERS.slice(0, 2)
    const page2 = MOCK_USERS.slice(2, 4)

    mockResolve
      .mockResolvedValueOnce(makeConnection(page1, true, 'user-cursor-2', 5))
      .mockResolvedValueOnce(makeConnection(page2, true, 'user-cursor-4', 5))
      .mockResolvedValueOnce(makeConnection(page1, true, 'user-cursor-2', 5))

    const { result } = renderHook(() => useUsers(2))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.pagination.currentPage).toBe(1)
    expect(result.current.users.length).toBe(2)

    act(() => { result.current.nextPage() })
    await waitFor(() => expect(result.current.pagination.currentPage).toBe(2))
    expect(result.current.users.length).toBe(2)

    act(() => { result.current.prevPage() })
    await waitFor(() => expect(result.current.pagination.currentPage).toBe(1))

    expect(mockResolve).toHaveBeenCalledTimes(3)
  })

  it('computes totalPages from totalCount', async () => {
    mockResolve.mockResolvedValue(makeConnection(MOCK_USERS.slice(0, 2), true, 'c1', 5))

    const { result } = renderHook(() => useUsers(2))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.pagination.totalPages).toBe(3)
    expect(result.current.pagination.totalCount).toBe(5)
  })

  it('provides a refetch function', async () => {
    mockResolve.mockResolvedValue(makeConnection([], false, null, 0))

    const { result } = renderHook(() => useUsers(10))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(typeof result.current.refetch).toBe('function')

    mockResolve.mockResolvedValue(makeConnection(MOCK_USERS, false, null, 5))
    act(() => { result.current.refetch() })

    await waitFor(() => {
      expect(result.current.users.length).toBe(5)
    })

    expect(mockResolve).toHaveBeenCalledTimes(2)
  })

  it('does not navigate before page 1 or past last page', async () => {
    mockResolve.mockResolvedValue(makeConnection(MOCK_USERS, false, null, 5))

    const { result } = renderHook(() => useUsers(10))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.prevPage() })
    expect(result.current.pagination.currentPage).toBe(1)

    act(() => { result.current.nextPage() })
    expect(result.current.pagination.currentPage).toBe(1)

    expect(mockResolve).toHaveBeenCalledTimes(1)
  })
})
