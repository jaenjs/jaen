import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '../helpers'
import { MOCK_TRANSFERS } from '../fixtures/transfers'

const mockNavigate = vi.fn()
const mockRefetch = vi.fn()
const mockNextPage = vi.fn()
const mockPrevPage = vi.fn()
const mockGoToPage = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const defaultPagination = {
  hasNextPage: false,
  hasPreviousPage: false,
  endCursor: null,
  startCursor: null,
  totalCount: MOCK_TRANSFERS.length,
  currentPage: 1,
  totalPages: 1,
}

vi.mock('../../shared/hooks', () => ({
  useTransfers: vi.fn(() => ({
    transfers: MOCK_TRANSFERS,
    isLoading: false,
    error: null,
    pagination: defaultPagination,
    nextPage: mockNextPage,
    prevPage: mockPrevPage,
    goToPage: mockGoToPage,
    refetch: mockRefetch,
  })),
  useUsers: vi.fn(() => ({
    users: [],
    isLoading: false,
    error: null,
    pagination: { ...defaultPagination, totalCount: 0 },
    nextPage: vi.fn(),
    prevPage: vi.fn(),
    refetch: vi.fn(),
  })),
  useCars: vi.fn(() => ({
    cars: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
  assignDriverMutation: vi.fn(),
  assignCarMutation: vi.fn(),
  setPriceMutation: vi.fn(),
  createTransferMutation: vi.fn(),
}))

import { TransfersView } from '../../shared/views/TransfersView'
import { useTransfers } from '../../shared/hooks'

const mockUseTransfers = vi.mocked(useTransfers)

beforeEach(() => {
  vi.clearAllMocks()
  mockUseTransfers.mockReturnValue({
    transfers: MOCK_TRANSFERS,
    isLoading: false,
    error: null,
    pagination: defaultPagination,
    nextPage: mockNextPage,
    prevPage: mockPrevPage,
    goToPage: mockGoToPage,
    refetch: mockRefetch,
  } as any)
})

describe('TransfersView', () => {
  it('renders loading state', () => {
    mockUseTransfers.mockReturnValue({
      transfers: [], isLoading: true, error: null,
      pagination: { ...defaultPagination, totalCount: 0 },
      nextPage: mockNextPage, prevPage: mockPrevPage, goToPage: mockGoToPage, refetch: mockRefetch,
    } as any)
    renderWithRouter(<TransfersView />)
    expect(screen.getByRole('heading', { level: 1, name: 'Transfers' })).toBeInTheDocument()
  })

  it('renders transfer table with data and shows total count', () => {
    renderWithRouter(<TransfersView />)
    expect(screen.getByRole('heading', { level: 1, name: 'Transfers' })).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`${MOCK_TRANSFERS.length} transfers total`))).toBeInTheDocument()
  })

  it('calls refetch when refresh button is clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<TransfersView />)
    const refreshBtn = screen.getByRole('button', { name: /refresh/i })
    await user.click(refreshBtn)
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('filters transfers by search query on current page', async () => {
    const user = userEvent.setup()
    renderWithRouter(<TransfersView />)
    const searchInput = screen.getByPlaceholderText('Search...')
    await user.type(searchInput, 'REF-001')
    const matches = screen.getAllByText('REF-001')
    expect(matches.length).toBeGreaterThan(0)
  })

  it('shows error banner when there is an error', () => {
    mockUseTransfers.mockReturnValue({
      transfers: [], isLoading: false, error: 'Something went wrong',
      pagination: { ...defaultPagination, totalCount: 0 },
      nextPage: mockNextPage, prevPage: mockPrevPage, goToPage: mockGoToPage, refetch: mockRefetch,
    } as any)
    renderWithRouter(<TransfersView />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('renders cursor pagination with next/previous buttons', () => {
    mockUseTransfers.mockReturnValue({
      transfers: MOCK_TRANSFERS.slice(0, 5),
      isLoading: false, error: null,
      pagination: { ...defaultPagination, totalCount: 20, totalPages: 4, hasNextPage: true },
      nextPage: mockNextPage, prevPage: mockPrevPage, goToPage: mockGoToPage, refetch: mockRefetch,
    } as any)
    renderWithRouter(<TransfersView />)
    expect(screen.getByText('Next')).toBeInTheDocument()
    expect(screen.getByText('Previous')).toBeInTheDocument()
    expect(screen.getByText(/of 4/)).toBeInTheDocument()
  })

  it('calls nextPage when Next button is clicked', async () => {
    const user = userEvent.setup()
    mockUseTransfers.mockReturnValue({
      transfers: MOCK_TRANSFERS.slice(0, 5),
      isLoading: false, error: null,
      pagination: { ...defaultPagination, totalCount: 20, totalPages: 4, hasNextPage: true },
      nextPage: mockNextPage, prevPage: mockPrevPage, goToPage: mockGoToPage, refetch: mockRefetch,
    } as any)
    renderWithRouter(<TransfersView />)
    await user.click(screen.getByText('Next'))
    expect(mockNextPage).toHaveBeenCalledTimes(1)
  })
})
