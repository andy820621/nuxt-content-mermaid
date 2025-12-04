export default defineNuxtConfig({
  modules: ['../src/module', '@nuxt/content', '@nuxtjs/color-mode'],
  devtools: { enabled: true },
  colorMode: {
    preference: 'system',
    fallback: 'light',
    dataValue: 'theme',
    classSuffix: '',
  },
  compatibilityDate: '2025-11-24',
  nitro: { compatibilityDate: '2025-11-24' },
  contentMermaid: {
    loader: {
      // init: {
      //   theme: 'base',
      //   logLevel: 'info',
      //   fontFamily: 'Courier New', // Visual check:
      // },
      // lazy: false, // true/false also { threshold: 1.0 }
    },
    theme: {
      // useColorModeTheme: false,
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
