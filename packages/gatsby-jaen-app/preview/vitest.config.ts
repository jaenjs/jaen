/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  define: {
    __JAEN_ZITADEL__: JSON.stringify({ authority: 'preview', clientId: 'preview' }),
  },
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, '../client/limosen'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    css: false,
    include: ['test/**/*.test.{ts,tsx}'],
  },
})
