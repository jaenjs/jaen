import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { SINGLE_USER } from '../fixtures/users'

vi.mock('../../shared/client', () => ({
  resolve: vi.fn(),
  client: {},
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  schema: {},
}))

import { useUser } from '../../shared/hooks'
import { resolve } from '../../shared/client'

const mockResolve = vi.mocked(resolve)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useUser', () => {
  it('sets isLoading initially', () => {
    mockResolve.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useUser('user-1'))
    expect(result.current.isLoading).toBe(true)
    expect(result.current.user).toBeUndefined()
  })

  it('fetches a single user by ID', async () => {
    mockResolve.mockResolvedValue(SINGLE_USER)

    const { result } = renderHook(() => useUser('user-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.user).toBeDefined()
    expect(result.current.user!.id).toBe(SINGLE_USER.id)
    expect(result.current.error).toBeNull()
  })

  it('handles error for non-existent user', async () => {
    mockResolve.mockRejectedValue(new Error('User not found'))

    const { result } = renderHook(() => useUser('invalid-id'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('User not found')
    expect(result.current.user).toBeUndefined()
  })

  it('re-fetches when userId changes', async () => {
    mockResolve.mockResolvedValue(SINGLE_USER)

    const { result, rerender } = renderHook(
      ({ id }) => useUser(id),
      { initialProps: { id: 'user-1' } }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    rerender({ id: 'user-2' })

    await waitFor(() => {
      expect(mockResolve).toHaveBeenCalledTimes(2)
    })
  })
})
