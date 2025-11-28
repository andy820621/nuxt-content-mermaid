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
  mermaidContent: {
    loader: {
      // importSource: '/mermaid/mermaid.esm.min.mjs',
      // importSource: 'https://cdn.jsdelivr.net/npm/mermaid@11.12.1/dist/mermaid.esm.min.mjs',
      // init: { theme: 'base' },
      // lazy: false, // true/false also { threshold: 1.0 }
    },
    theme: {
      // useColorModeTheme: true,
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
