import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import React from 'react'
import { SINGLE_USER } from '../fixtures/users'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../shared/hooks', () => ({
  useUser: vi.fn((id: string) => ({
    user: id === SINGLE_USER.id ? SINGLE_USER : undefined,
    isLoading: false,
    error: null,
  })),
}))

import { UserDetailView } from '../../shared/views/UserDetailView'
import { useUser } from '../../shared/hooks'

const mockUseUser = vi.mocked(useUser)

function renderDetail(userId: string) {
  return render(
    <MemoryRouter initialEntries={[`/users/${userId}`]}>
      <Routes>
        <Route path="/users/:userId" element={<UserDetailView />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseUser.mockImplementation((id: string) => ({
    user: id === SINGLE_USER.id ? SINGLE_USER : undefined,
    isLoading: false,
    error: null,
  }))
})

describe('UserDetailView', () => {
  it('renders loading state', () => {
    mockUseUser.mockReturnValue({ user: undefined, isLoading: true, error: null })
    renderDetail(SINGLE_USER.id)
    expect(screen.queryByText(SINGLE_USER.username)).not.toBeInTheDocument()
  })

  it('renders user details when found', () => {
    renderDetail(SINGLE_USER.id)
    expect(screen.getByText('Baris Yilmaz')).toBeInTheDocument()
    expect(screen.getByText(`@${SINGLE_USER.username}`)).toBeInTheDocument()
    expect(screen.getByText(SINGLE_USER.primaryEmailAddress)).toBeInTheDocument()
    expect(screen.getByText('Account Details')).toBeInTheDocument()
  })

  it('shows "not found" for invalid user ID', () => {
    mockUseUser.mockReturnValue({ user: undefined, isLoading: false, error: null })
    renderDetail('nonexistent-id')
    expect(screen.getByText('User not found')).toBeInTheDocument()
  })

  it('navigates back to users list', async () => {
    const user = userEvent.setup()
    renderDetail(SINGLE_USER.id)
    const backBtns = screen.getAllByText(/back to users/i)
    await user.click(backBtns[0])
    expect(mockNavigate).toHaveBeenCalledWith('/users')
  })
})
