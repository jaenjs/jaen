import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import React from 'react'
import { MOCK_TRANSFERS, SINGLE_TRANSFER } from '../fixtures/transfers'

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
  updateTransferStateMutation: vi.fn(),
  setPriceMutation: vi.fn(),
}))

import { TransferDetailView } from '../../shared/views/TransferDetailView'
import { useTransfers } from '../../shared/hooks'

const mockUseTransfers = vi.mocked(useTransfers)

function renderDetail(transferId: string) {
  return render(
    <MemoryRouter initialEntries={[`/transfers/${transferId}`]}>
      <Routes>
        <Route path="/transfers/:transferId" element={<TransferDetailView />} />
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

describe('TransferDetailView', () => {
  it('renders loading state', () => {
    mockUseTransfers.mockReturnValue({
      transfers: [], isLoading: true, error: null,
      pagination: { ...defaultPagination, totalCount: 0 },
      nextPage: vi.fn(), prevPage: vi.fn(), goToPage: vi.fn(), refetch: vi.fn(),
    } as any)
    renderDetail(SINGLE_TRANSFER.id)
    expect(screen.queryByText(/Transfer REF/)).not.toBeInTheDocument()
  })

  it('renders transfer details when found', () => {
    renderDetail(SINGLE_TRANSFER.id)
    expect(screen.getByText(/Transfer REF-001/)).toBeInTheDocument()
    expect(screen.getByText(SINGLE_TRANSFER.pickup)).toBeInTheDocument()
    expect(screen.getByText(SINGLE_TRANSFER.dropoff)).toBeInTheDocument()
  })

  it('shows "not found" for invalid transfer ID', () => {
    renderDetail('nonexistent-id')
    expect(screen.getByText('Transfer not found')).toBeInTheDocument()
  })

  it('navigates back when "Back to Transfers" is clicked', async () => {
    const user = userEvent.setup()
    renderDetail(SINGLE_TRANSFER.id)
    const backBtns = screen.getAllByText(/back to transfers/i)
    await user.click(backBtns[0])
    expect(mockNavigate).toHaveBeenCalledWith('/transfers')
  })

  it('displays route, schedule, driver, vehicle, and extras sections', () => {
    renderDetail(SINGLE_TRANSFER.id)
    expect(screen.getByText('Route')).toBeInTheDocument()
    expect(screen.getByText('Schedule')).toBeInTheDocument()
    expect(screen.getByText('Driver')).toBeInTheDocument()
    expect(screen.getByText(SINGLE_TRANSFER.driverName!)).toBeInTheDocument()
    expect(screen.getByText('Vehicle')).toBeInTheDocument()
    expect(screen.getByText('Extras')).toBeInTheDocument()
    expect(screen.getByText('Total Fare')).toBeInTheDocument()
  })
})
