import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// `npm run icons` — пересоздать иконки PWA из public/icon.svg.
// Фон в самом SVG и ракета в безопасной зоне (круг 80%), поэтому поля не нужны.
const full = { padding: 0, resizeOptions: { background: '#121417' } }

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, ...full },
    maskable: { ...minimal2023Preset.maskable, ...full },
    apple: { ...minimal2023Preset.apple, ...full },
  },
  images: ['public/icon.svg'],
})
