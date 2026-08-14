export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
    '@barzhsieh/nuxt-content-mermaid',
  ],
  css: ['~/assets/css/main.css'],
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
      lazy: true,
    },
    theme: {
      light: 'default',
      dark: 'dark',
    },
    toolbar: {
      title: 'Mermaid source',
    },
  },
})
