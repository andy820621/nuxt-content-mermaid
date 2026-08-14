import { loadWebsiteReferencePublicModel } from '../scripts/website/reference-public.mjs'

const websiteReference = await loadWebsiteReferencePublicModel()

export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
    '@barzhsieh/nuxt-content-mermaid',
  ],
  css: ['~/assets/css/main.css'],
  appConfig: {
    websiteReference,
  } as never,
  srcDir: '.',
  compatibilityDate: '2025-11-24',
  nitro: {
    compatibilityDate: '2025-11-24',
    prerender: {
      crawlLinks: false,
      routes: ['/', '/getting-started', '/troubleshooting', '/migration/v3', '/reference'],
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
