import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

/** Genera los íconos PWA a partir de public/icon.svg: npx pwa-assets-generator */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, resizeOptions: { background: '#0B0A10' } },
    apple: { ...minimal2023Preset.apple, padding: 0.1, resizeOptions: { background: '#0B0A10' } },
  },
  images: ['public/icon.svg'],
})
