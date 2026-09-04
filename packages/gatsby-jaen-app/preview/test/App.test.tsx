import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

const defaultPagination = {
  hasNextPage: false,
  hasPreviousPage: false,
  endCursor: null,
  startCursor: null,
  totalCount: 0,
  currentPage: 1,
  totalPages: 1,
}

vi.mock('../src/hooks', () => ({
  useTransfers: vi.fn(() => ({
    transfers: [],
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
    pagination: defaultPagination,
    nextPage: vi.fn(),
    prevPage: vi.fn(),
    refetch: vi.fn(),
  })),
  useUser: vi.fn(() => ({
    user: undefined,
    isLoading: false,
    error: null,
  })),
  useLocations: vi.fn(() => ({
    locations: [],
    isLoading: false,
    error: null,
    pagination: defaultPagination,
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
  createTransferMutation: vi.fn(),
}))

import App from '../src/App'

function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  )
}

describe('App routing', () => {
  it('redirects / to /transfers', () => {
    renderApp('/')
    // The page heading should be "Transfers" (sidebar also has it, use heading role)
    expect(screen.getByRole('heading', { level: 1, name: 'Transfers' })).toBeInTheDocument()
    expect(screen.getByText(/Manage all transfer operations/)).toBeInTheDocument()
  })

  it('renders DashboardView at /dashboard', () => {
    renderApp('/dashboard')
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText(/Manage your journeys and operations/)).toBeInTheDocument()
  })

  it('renders TransfersView at /transfers', () => {
    renderApp('/transfers')
    expect(screen.getByRole('heading', { level: 1, name: 'Transfers' })).toBeInTheDocument()
    expect(screen.getByText(/Manage all transfer operations/)).toBeInTheDocument()
  })

  it('renders UsersView at /users', () => {
    renderApp('/users')
    expect(screen.getByRole('heading', { level: 1, name: 'Users' })).toBeInTheDocument()
    expect(screen.getByText(/Manage user accounts/)).toBeInTheDocument()
  })

  it('renders LocationsView at /locations', () => {
    renderApp('/locations')
    expect(screen.getByRole('heading', { level: 1, name: 'Locations' })).toBeInTheDocument()
    expect(screen.getByText(/Driver and customer location tracking/)).toBeInTheDocument()
  })
})
