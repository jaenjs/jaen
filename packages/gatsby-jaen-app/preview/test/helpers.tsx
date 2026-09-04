import React from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Render wrapper that provides a router context.
 */
export function renderWithRouter(
  ui: React.ReactElement,
  { route = '/', ...options }: RenderOptions & { route?: string } = {}
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    ),
    ...options,
  })
}
