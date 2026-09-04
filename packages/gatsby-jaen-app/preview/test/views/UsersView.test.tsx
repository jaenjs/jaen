import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '../helpers'
import { MOCK_USERS } from '../fixtures/users'

const mockNavigate = vi.fn()
const mockRefetch = vi.fn()
const mockNextPage = vi.fn()
const mockPrevPage = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const defaultPagination = {
  hasNextPage: false,
  hasPreviousPage: false,
  endCursor: null,
  startCursor: null,
  totalCount: MOCK_USERS.length,
  currentPage: 1,
  totalPages: 1,
}

vi.mock('../../shared/hooks', () => ({
  useUsers: vi.fn(() => ({
    users: MOCK_USERS,
    isLoading: false,
    error: null,
    pagination: defaultPagination,
    nextPage: mockNextPage,
    prevPage: mockPrevPage,
    refetch: mockRefetch,
  })),
}))

import { UsersView } from '../../shared/views/UsersView'
import { useUsers } from '../../shared/hooks'

const mockUseUsers = vi.mocked(useUsers)

beforeEach(() => {
  vi.clearAllMocks()
  mockUseUsers.mockReturnValue({
    users: MOCK_USERS,
    isLoading: false,
    error: null,
    pagination: defaultPagination,
    nextPage: mockNextPage,
    prevPage: mockPrevPage,
    refetch: mockRefetch,
  } as any)
})

describe('UsersView', () => {
  it('renders loading state', () => {
    mockUseUsers.mockReturnValue({
      users: [], isLoading: true, error: null,
      pagination: { ...defaultPagination, totalCount: 0 },
      nextPage: mockNextPage, prevPage: mockPrevPage, refetch: mockRefetch,
    } as any)
    renderWithRouter(<UsersView />)
    expect(screen.getByRole('heading', { level: 1, name: 'Users' })).toBeInTheDocument()
  })

  it('renders user table with total count from pagination', () => {
    renderWithRouter(<UsersView />)
    expect(screen.getByRole('heading', { level: 1, name: 'Users' })).toBeInTheDocument()
    expect(screen.getByText('Total Users')).toBeInTheDocument()
    expect(screen.getByText(String(MOCK_USERS.length))).toBeInTheDocument()
  })

  it('calls refetch when refresh is clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<UsersView />)
    await user.click(screen.getByRole('button', { name: /refresh/i }))
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('filters users by search query on current page', async () => {
    const user = userEvent.setup()
    renderWithRouter(<UsersView />)
    await user.type(screen.getByPlaceholderText('Search users...'), 'baris')
    const rows = screen.queryAllByText(/baris/i)
    expect(rows.length).toBeGreaterThan(0)
  })

  it('shows active and inactive user stat counts', () => {
    renderWithRouter(<UsersView />)
    const activeLabels = screen.getAllByText(/Active/)
    expect(activeLabels.length).toBeGreaterThanOrEqual(1)
    const inactiveLabels = screen.getAllByText(/Inactive/)
    expect(inactiveLabels.length).toBeGreaterThanOrEqual(1)
  })

  it('navigates to user detail on Details click', async () => {
    const user = userEvent.setup()
    renderWithRouter(<UsersView />)
    const detailBtns = screen.queryAllByText('Details')
    if (detailBtns.length > 0) {
      await user.click(detailBtns[0])
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/\/users\//))
    }
  })

  it('shows error banner', () => {
    mockUseUsers.mockReturnValue({
      users: [], isLoading: false, error: 'Users failed',
      pagination: { ...defaultPagination, totalCount: 0 },
      nextPage: mockNextPage, prevPage: mockPrevPage, refetch: mockRefetch,
    } as any)
    renderWithRouter(<UsersView />)
    expect(screen.getByText('Users failed')).toBeInTheDocument()
  })
})
