import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after every test
afterEach(() => {
  cleanup()
})

// Mock sessionStorage (needed by GQty queryFetcher)
const storage: Record<string, string> = {}
Object.defineProperty(globalThis, 'sessionStorage', {
  value: {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => { storage[key] = value },
    removeItem: (key: string) => { delete storage[key] },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
    get length() { return Object.keys(storage).length },
    key: (i: number) => Object.keys(storage)[i] ?? null,
  },
  writable: true,
})

// Mock window.matchMedia (used by responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
