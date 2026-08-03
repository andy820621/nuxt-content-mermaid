import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineNuxtConfig } from 'nuxt/config'
import MyModule from '../../../src/module'

const fixtureDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  modules: [
    MyModule,
    '@nuxt/content',
  ],
  alias: {
    mermaid: resolve(fixtureDir, '../custom-renderer/mermaid-stub.ts'),
  },
  compatibilityDate: '2025-11-24',
  nitro: {
    compatibilityDate: '2025-11-24',
  },
  contentMermaid: {
    loader: {
      lazy: false,
    },
    components: {
      renderer: 'MissingRenderer',
    },
  },
})
