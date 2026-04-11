/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'robots.txt', 'offline.html', 'fonts/*.woff2'],
      manifest: {
        name: 'Quartinho - Clube de Escuta',
        short_name: 'Quartinho',
        description: 'Clube de escuta coletiva',
        theme_color: '#98D9C2',
        background_color: '#F5F5DC',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          // Primary: vector icon (infinite-resolution, ~3KB).
          {
            src: 'logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          // PNG fallbacks for launchers/OSes that still require raster icons,
          // rasterized from the same SVG via Inkscape.
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache shell + self-hosted fonts.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // SPA navigation fallback: all client-side routes (/u/:username,
        // /event/:id, etc.) are served the precached index.html shell. React
        // Router then renders the right view. Deep links work offline as long
        // as the shell + JS bundles are precached.
        navigateFallback: '/index.html',
        // Don't hijack API calls that happen to be navigations (none today,
        // but keeps us safe if anything ever hits /api/* as a document).
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // API reads — network first, fall back to cache when offline or
            // when the backend is slow (Cloud Run cold starts can take 10-15s,
            // so a 5s timeout was aborting legitimate requests and surfacing
            // as fake "offline" errors to users).
            urlPattern: /\/(auth|events|users|votes|moderation|photos|shop|linktree|banners|mb|lyrics)\b/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'quartinho-api',
              networkTimeoutSeconds: 15,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // R2 / MinIO storage (avatars, banner images). Matches:
            //   - pub-<hash>.r2.dev         (production public URL)
            //   - r2.cloudflarestorage.com  (legacy, pre-fix — kept until
            //                                migration rewrites stored URLs)
            //   - localhost:9002            (local MinIO dev)
            urlPattern: /r2\.dev|r2\.cloudflarestorage\.com|localhost:9002/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'quartinho-r2',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Album art / photos from Firebase Storage.
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'quartinho-media',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // MusicBrainz cover art proxy.
            urlPattern: /^https:\/\/coverartarchive\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'quartinho-coverart',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // P7-S1 — deterministic chunk split so vendors don't bloat the app chunk.
    // firebase is ~70% of the bundle; isolating it lets the app chunk stay
    // cache-friendly across deploys that only touch app code.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase-app': ['firebase/app'],
          'vendor-firebase-auth': ['firebase/auth'],
          'vendor-firebase-firestore': ['firebase/firestore'],
          'vendor-firebase-database': ['firebase/database'],
          'vendor-firebase-storage': ['firebase/storage'],
          'vendor-state': ['zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
