import contentMermaidModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [contentMermaidModule],
  compatibilityDate: '2025-11-24',
  nitro: {
    compatibilityDate: '2025-11-24',
  },
  // @ts-expect-error 3.0 removes the legacy configuration key
  mermaidContent: {},
})
