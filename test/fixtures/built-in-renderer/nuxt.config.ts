import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineNuxtConfig } from 'nuxt/config'
import MyModule from '../../../src/module'

const fixtureDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  modules: [
    MyModule,
    '@nuxt/content',
  ],
  components: [
    '~/components',
    {
      path: resolve(fixtureDir, '../../../website/components'),
      pattern: 'LandingMermaidDemo.vue',
      pathPrefix: false,
    },
  ],
  alias: {
    'html-to-image': resolve(fixtureDir, 'html-to-image-stub.ts'),
    'mermaid': resolve(fixtureDir, 'mermaid-stub.ts'),
  },
  compatibilityDate: '2025-11-24',
  nitro: {
    compatibilityDate: '2025-11-24',
  },
  contentMermaid: {
    debug: true,
    loader: {
      lazy: false,
    },
    components: {
      spinner: 'TestSpinner',
      error: 'TestError',
    },
  },
})
