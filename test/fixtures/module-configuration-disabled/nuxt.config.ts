import contentMermaidModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [contentMermaidModule],
  compatibilityDate: '2025-11-24',
  nitro: {
    compatibilityDate: '2025-11-24',
  },
  contentMermaid: {
    enabled: false,
  },
})
