import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MOCK_TRANSFERS, SINGLE_TRANSFER } from '../fixtures/transfers'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import React from 'react'

const mockNavigate = vi.fn()

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
    nextPage: vi.fn(),
    prevPage: vi.fn(),
    goToPage: vi.fn(),
    refetch: vi.fn(),
  })),
}))

import { BookingDetailView } from '../../shared/views/BookingDetailView'
import { useTransfers } from '../../shared/hooks'

const mockUseTransfers = vi.mocked(useTransfers)

function renderDetail(bookingId: string) {
  return render(
    <MemoryRouter initialEntries={[`/booking/${bookingId}`]}>
      <Routes>
        <Route path="/booking/:bookingId" element={<BookingDetailView />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseTransfers.mockReturnValue({
    transfers: MOCK_TRANSFERS,
    isLoading: false,
    error: null,
    pagination: defaultPagination,
    nextPage: vi.fn(),
    prevPage: vi.fn(),
    goToPage: vi.fn(),
    refetch: vi.fn(),
  } as any)
})

describe('BookingDetailView', () => {
  it('renders loading state', () => {
    mockUseTransfers.mockReturnValue({
      transfers: [], isLoading: true, error: null,
      pagination: { ...defaultPagination, totalCount: 0 },
      nextPage: vi.fn(), prevPage: vi.fn(), goToPage: vi.fn(), refetch: vi.fn(),
    } as any)
    renderDetail(SINGLE_TRANSFER.id)
    expect(screen.queryByText(/Booking REF/)).not.toBeInTheDocument()
  })

  it('renders booking details when found', () => {
    renderDetail(SINGLE_TRANSFER.id)
    expect(screen.getByText(/Booking REF-001/)).toBeInTheDocument()
    expect(screen.getByText(SINGLE_TRANSFER.pickup)).toBeInTheDocument()
    expect(screen.getByText(SINGLE_TRANSFER.dropoff)).toBeInTheDocument()
  })

  it('shows "not found" for invalid booking ID', () => {
    renderDetail('nonexistent-id')
    expect(screen.getByText('Booking not found')).toBeInTheDocument()
  })

  it('navigates back to bookings list', async () => {
    const user = userEvent.setup()
    renderDetail(SINGLE_TRANSFER.id)
    const backBtn = screen.getByText(/back to bookings/i)
    await user.click(backBtn)
    expect(mockNavigate).toHaveBeenCalledWith('/booking')
  })
})
