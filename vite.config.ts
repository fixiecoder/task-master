import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 3005,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        // Keep the existing "don't cache API calls" behavior: only the
        // built app shell is precached, same as the old generateSW default.
      },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Task Master',
        short_name: 'Task Master',
        description: 'Task management tool for the colinadams.co suite',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // No runtimeCaching entries: API calls (a different origin from
      // VITE_API_URL) are left untouched by the service worker, so task
      // reads/writes and AI chat always go straight to the network and
      // never serve a stale response. Offline reads are served from
      // IndexedDB by src/db.ts instead.
      // injectManifest (rather than the default generateSW) is used so
      // src/sw.ts can also handle FCM background push notifications.
    }),
  ],
})
