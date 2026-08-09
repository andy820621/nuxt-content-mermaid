import contentMermaidModule from '../../../src/module'
import type { RuntimeMermaidConfig } from '../../../src/types/config'

export default defineNuxtConfig({
  modules: [contentMermaidModule],
  runtimeConfig: {
    public: {
      contentMermaid: {
        debug: false,
        expand: {
          margin: 24,
        },
        toolbar: {
          title: 'runtime-title',
          buttons: {
            fullscreen: false,
          },
        },
        loader: {
          init: {
            unknownMermaidExtension: 'runtime-mermaid-extension',
          } as RuntimeMermaidConfig,
        },
      },
    },
  },
  compatibilityDate: '2025-11-24',
  nitro: {
    compatibilityDate: '2025-11-24',
  },
  contentMermaid: {
    debug: true,
    expand: false,
    toolbar: {
      title: 'Nuxt option title',
      buttons: {
        copy: false,
      },
    },
    loader: {
      init: {
        theme: 'forest',
      },
    },
  },
})
