export default defineNuxtConfig({
  modules: [
    '@barzhsieh/nuxt-content-mermaid',
    '@nuxt/content',
  ],
  srcDir: '.',
  compatibilityDate: '2025-11-24',
  nitro: {
    compatibilityDate: '2025-11-24',
  },
  contentMermaid: {
    loader: {
      lazy: false,
    },
  },
})
