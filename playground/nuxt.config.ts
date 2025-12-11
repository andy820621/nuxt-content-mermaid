export default defineNuxtConfig({
  modules: ['../src/module', '@nuxt/content', '@nuxtjs/color-mode'],
  devtools: { enabled: true },
  css: ['~/assets/css/mermaid-page.css'],
  colorMode: {
    preference: 'system',
    fallback: 'light',
    dataValue: 'theme',
    classSuffix: '',
  },
  compatibilityDate: '2025-11-24',
  nitro: { compatibilityDate: '2025-11-24' },
  contentMermaid: {
    debug: true,
    loader: {
      // init: {
      //   theme: 'base',
      //   logLevel: 'info',
      //   fontFamily: 'Courier New', // Visual check:
      // },
      // lazy: false, // true/false also { threshold: 1.0 }
    },
    theme: {
      // light: 'default',
      // dark: 'dark',
    },
    components: {
      // renderer: 'MyMermaid',
      // spinner: 'MySpinner',
      // error: 'MermaidError',
    },
  },
})
