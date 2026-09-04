import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')

  return {
    plugins: [react()],
    define: {
      __JAEN_ZITADEL__: JSON.stringify({ authority: 'preview', clientId: 'preview' }),
      'process.env.GATSBY_MAPBOX_TOKEN': JSON.stringify(env.MAPBOX_TOKEN || ''),
    },
    resolve: {
      alias: {
        '@client': path.resolve(__dirname, '../client/limosen'),
        'mapbox-gl': path.resolve(__dirname, 'node_modules/mapbox-gl'),
      },
    },
    server: {
      port: 5173,
    },
  }
})
