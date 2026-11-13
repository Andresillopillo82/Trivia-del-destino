/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Trivia del Destino',
        short_name: 'Trivia Destino',
        description: 'Preguntas de cultura general con cartas del tarot. Revela tu carta, reta a tu grupo y conviértete en Dueño del Destino.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0B0A10',
        background_color: '#0B0A10',
        categories: ['games', 'education', 'entertainment'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Solo las tipografías con alfabeto latino (el resto nunca se usa en español).
        globIgnores: ['**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2'],
        navigateFallback: '/index.html',
        // Rutas reservadas de Firebase Hosting/Auth: no las sirve el service worker.
        navigateFallbackDenylist: [/^\/__\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // Pre-empaquetar las dependencias desde el arranque evita recargas del servidor de desarrollo
  // al descubrirlas en caliente.
  optimizeDeps: {
    include: [
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'react-router-dom',
      'framer-motion',
      'qrcode',
      'canvas-confetti',
    ],
  },
  build: {
    // El SDK de Firestore ocupa ~640 kB (190 kB comprimido) y no se puede dividir más.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        // Firebase y React cambian poco: en archivos aparte el navegador los reutiliza entre versiones.
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
