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
}))

import { BookingView } from '../../shared/views/BookingView'
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

describe('BookingView', () => {
  it('renders loading state', () => {
    mockUseTransfers.mockReturnValue({
      transfers: [], isLoading: true, error: null,
      pagination: { ...defaultPagination, totalCount: 0 },
      nextPage: mockNextPage, prevPage: mockPrevPage, goToPage: mockGoToPage, refetch: mockRefetch,
    } as any)
    renderWithRouter(<BookingView />)
    expect(screen.getByRole('heading', { level: 1, name: 'Bookings' })).toBeInTheDocument()
  })

  it('renders booking table with data and shows count', () => {
    renderWithRouter(<BookingView />)
    expect(screen.getByRole('heading', { level: 1, name: 'Bookings' })).toBeInTheDocument()
    expect(screen.getByText(`${MOCK_TRANSFERS.length} bookings`)).toBeInTheDocument()
  })

  it('calls refetch when refresh button is clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<BookingView />)
    await user.click(screen.getByRole('button', { name: /refresh/i }))
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('filters bookings by search query', async () => {
    const user = userEvent.setup()
    renderWithRouter(<BookingView />)
    await user.type(screen.getByPlaceholderText('Search...'), 'REF-001')
    expect(screen.getByText('1 bookings')).toBeInTheDocument()
  })

  it('shows error banner', () => {
    mockUseTransfers.mockReturnValue({
      transfers: [], isLoading: false, error: 'Booking error',
      pagination: { ...defaultPagination, totalCount: 0 },
      nextPage: mockNextPage, prevPage: mockPrevPage, goToPage: mockGoToPage, refetch: mockRefetch,
    } as any)
    renderWithRouter(<BookingView />)
    expect(screen.getByText('Booking error')).toBeInTheDocument()
  })
})
