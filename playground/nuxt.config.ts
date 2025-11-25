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
    // followColorMode: false,
    // lightTheme: 'forest',
    // darkTheme: 'neutral',
    // init: { theme: "forest" },
    // mermaidComponent: "MyMermaid",
    // spinnerComponent: "MySpinner",
  },
})
