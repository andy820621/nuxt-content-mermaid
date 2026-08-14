export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
    '@barzhsieh/nuxt-content-mermaid',
  ],
  srcDir: '.',
  compatibilityDate: '2025-11-24',
  nitro: {
    compatibilityDate: '2025-11-24',
    prerender: {
      crawlLinks: false,
      routes: ['/', '/getting-started'],
    },
  },
  contentMermaid: {
    loader: {
      lazy: false,
    },
  },
})
