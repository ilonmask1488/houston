import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// На GitHub Pages сайт живёт в подпапке /<имя-репозитория>/ — её передаёт workflow.
const base = process.env.BASE_PATH || '/'

// Манифест звука грузится при запуске — кладём его в предзагрузку с ревизией по содержимому.
const audioManifestRevision = createHash('md5').update(readFileSync(new URL('./public/audio/manifest.json', import.meta.url))).digest('hex')

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Houston — английский: эфир, позывной, техдок',
        short_name: 'Houston',
        description: 'Ежедневный сеанс связи с английским: быстрая речь на слух, говорение, собеседования, письма, техническое чтение.',
        lang: 'ru',
        dir: 'ltr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0e1215',
        theme_color: '#0e1215',
        categories: ['education'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Оболочка приложения целиком: код, стили, иконки, шрифты (кроме ненужных поднаборов).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        // Греческий поднабор нужен: θ в транскрипции (think /θɪŋk/) — греческая буква.
        globIgnores: ['**/*vietnamese*', '**/audio/**'],
        additionalManifestEntries: [{ url: 'audio/manifest.json', revision: audioManifestRevision }],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Аудио кэшируется по мере прослушивания + «скачать для офлайна».
            urlPattern: ({ url }) => url.pathname.includes('/audio/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio',
              rangeRequests: true,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto', 'src/content/test-setup.ts'],
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
