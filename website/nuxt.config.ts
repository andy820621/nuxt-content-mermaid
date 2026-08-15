import { addTemplate, defineNuxtModule } from '@nuxt/kit'
import { loadWebsiteReferencePublicModel } from '../scripts/website/reference-public.mjs'

const websiteReference = await loadWebsiteReferencePublicModel()
const serializedWebsiteReference = JSON.stringify(websiteReference)
  .replaceAll('\u2028', '\\u2028')
  .replaceAll('\u2029', '\\u2029')

const websiteReferenceModel = defineNuxtModule({
  meta: { name: 'website-reference-model' },
  setup() {
    addTemplate({
      filename: 'website-reference-model.ts',
      getContents: () => `export default ${serializedWebsiteReference} as const\n`,
    })
  },
})

export default defineNuxtConfig({
  modules: [
    websiteReferenceModel,
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
