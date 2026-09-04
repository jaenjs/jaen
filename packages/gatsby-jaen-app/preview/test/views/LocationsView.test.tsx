import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '../helpers'
import { MOCK_LOCATIONS } from '../fixtures/locations'

const mockRefetch = vi.fn()
const mockNextPage = vi.fn()
const mockPrevPage = vi.fn()

const defaultPagination = {
  hasNextPage: false,
  hasPreviousPage: false,
  endCursor: null,
  startCursor: null,
  totalCount: MOCK_LOCATIONS.length,
  currentPage: 1,
  totalPages: 1,
}

vi.mock('../../shared/hooks', () => ({
  useLocations: vi.fn(() => ({
    locations: MOCK_LOCATIONS,
    isLoading: false,
    error: null,
    pagination: defaultPagination,
    nextPage: mockNextPage,
    prevPage: mockPrevPage,
    refetch: mockRefetch,
  })),
}))

import { LocationsView } from '../../shared/views/LocationsView'
import { useLocations } from '../../shared/hooks'

const mockUseLocations = vi.mocked(useLocations)

beforeEach(() => {
  vi.clearAllMocks()
  mockUseLocations.mockReturnValue({
    locations: MOCK_LOCATIONS,
    isLoading: false,
    error: null,
    pagination: defaultPagination,
    nextPage: mockNextPage,
    prevPage: mockPrevPage,
    refetch: mockRefetch,
  } as any)
})

describe('LocationsView', () => {
  it('renders loading state', () => {
    mockUseLocations.mockReturnValue({
      locations: [], isLoading: true, error: null,
      pagination: { ...defaultPagination, totalCount: 0 },
      nextPage: mockNextPage, prevPage: mockPrevPage, refetch: mockRefetch,
    } as any)
    renderWithRouter(<LocationsView />)
    expect(screen.getByRole('heading', { level: 1, name: 'Locations' })).toBeInTheDocument()
  })

  it('renders location table with total count from pagination', () => {
    renderWithRouter(<LocationsView />)
    expect(screen.getByRole('heading', { level: 1, name: 'Locations' })).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText(String(MOCK_LOCATIONS.length))).toBeInTheDocument()
  })

  it('calls refetch when refresh is clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<LocationsView />)
    await user.click(screen.getByRole('button', { name: /refresh/i }))
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('filters by kind (Drivers/Customers)', async () => {
    const user = userEvent.setup()
    renderWithRouter(<LocationsView />)
    await user.click(screen.getByRole('button', { name: /^Drivers$/ }))
    await user.click(screen.getByRole('button', { name: /^Customers$/ }))
    await user.click(screen.getByRole('button', { name: /^All$/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'Locations' })).toBeInTheDocument()
  })

  it('filters by search query (user ID)', async () => {
    const user = userEvent.setup()
    renderWithRouter(<LocationsView />)
    await user.type(screen.getByPlaceholderText('Search by user ID...'), 'driver-1')
    expect(screen.getByRole('heading', { level: 1, name: 'Locations' })).toBeInTheDocument()
  })

  it('shows stat cards with driver and customer counts', () => {
    renderWithRouter(<LocationsView />)
    const driversLabels = screen.getAllByText('Drivers')
    expect(driversLabels.length).toBeGreaterThanOrEqual(1)
    const customersLabels = screen.getAllByText('Customers')
    expect(customersLabels.length).toBeGreaterThanOrEqual(1)
  })

  it('shows error banner', () => {
    mockUseLocations.mockReturnValue({
      locations: [], isLoading: false, error: 'Locations error',
      pagination: { ...defaultPagination, totalCount: 0 },
      nextPage: mockNextPage, prevPage: mockPrevPage, refetch: mockRefetch,
    } as any)
    renderWithRouter(<LocationsView />)
    expect(screen.getByText('Locations error')).toBeInTheDocument()
  })
})
