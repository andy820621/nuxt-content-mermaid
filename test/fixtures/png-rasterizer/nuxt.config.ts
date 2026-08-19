import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { defineNuxtConfig } from 'nuxt/config'

const require = createRequire(import.meta.url)
const fontFixtureRoot = dirname(require.resolve(
  '@fontsource/noto-sans-tc/files/noto-sans-tc-latin-400-normal.woff2',
))

export default defineNuxtConfig({
  ssr: false,
  runtimeConfig: {
    fontFixtureRoot,
  },
  compatibilityDate: '2025-11-24',
  nitro: {
    compatibilityDate: '2025-11-24',
  },
})
