import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '../helpers'
import { MOCK_TRANSFERS, TODAY_TRANSFERS } from '../fixtures/transfers'

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

import { DashboardView } from '../../shared/views/DashboardView'
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

describe('DashboardView', () => {
  it('renders loading state', () => {
    mockUseTransfers.mockReturnValue({
      transfers: [], isLoading: true, error: null,
      pagination: { ...defaultPagination, totalCount: 0 },
      nextPage: mockNextPage, prevPage: mockPrevPage, goToPage: mockGoToPage, refetch: mockRefetch,
    } as any)
    renderWithRouter(<DashboardView />)
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })

  it('renders stat cards with correct labels', () => {
    renderWithRouter(<DashboardView />)
    expect(screen.getByText('Total Transfers')).toBeInTheDocument()
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Planned').length).toBeGreaterThanOrEqual(1)
  })

  it('shows totalCount from pagination in Total Transfers stat', () => {
    renderWithRouter(<DashboardView />)
    expect(screen.getByText(String(MOCK_TRANSFERS.length))).toBeInTheDocument()
  })

  it('calls refetch when refresh is clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<DashboardView />)
    await user.click(screen.getByRole('button', { name: /refresh/i }))
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('shows alert for unassigned transfers when applicable', () => {
    renderWithRouter(<DashboardView />)
    const unassignedToday = TODAY_TRANSFERS.filter(t => {
      const s = t.state?.toLowerCase?.() ?? ''
      const isCancelled = s === 'cancelled' || s === 'canceled' || s === 'terminated'
      return !isCancelled && (!t.driverName || !t.carLicensePlate)
    })
    if (unassignedToday.length > 0) {
      expect(screen.getByText(/journeys for today are not assigned yet/i)).toBeInTheDocument()
    }
  })

  it('shows upcoming transfers card', () => {
    renderWithRouter(<DashboardView />)
    expect(screen.getByText('Upcoming transfers')).toBeInTheDocument()
  })

  it('navigates to /transfers when View all is clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<DashboardView />)
    await user.click(screen.getByText('View all'))
    expect(mockNavigate).toHaveBeenCalledWith('/transfers')
  })

  it('shows error banner when there is an error', () => {
    mockUseTransfers.mockReturnValue({
      transfers: [], isLoading: false, error: 'API failed',
      pagination: { ...defaultPagination, totalCount: 0 },
      nextPage: mockNextPage, prevPage: mockPrevPage, goToPage: mockGoToPage, refetch: mockRefetch,
    } as any)
    renderWithRouter(<DashboardView />)
    expect(screen.getByText('API failed')).toBeInTheDocument()
  })
})
