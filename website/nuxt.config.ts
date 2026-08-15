import { fileURLToPath } from 'node:url'

const brandAssetsDir = fileURLToPath(new URL('../src/assets', import.meta.url))

export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
    '@barzhsieh/nuxt-content-mermaid',
  ],
  css: ['~/assets/css/main.css'],
  mdc: {
    highlight: {
      theme: {
        default: 'github-light',
        dark: 'github-dark-high-contrast',
      },
    },
  },
  nitro: {
    publicAssets: [
      {
        baseURL: '/assets',
        dir: brandAssetsDir,
      },
    ],
  },
  compatibilityDate: '2025-11-24',
})
