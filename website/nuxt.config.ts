import type { LocaleObject } from '@nuxtjs/i18n'
import { fileURLToPath } from 'node:url'

const brandAssetsDir = fileURLToPath(new URL('../src/assets', import.meta.url))

type SupportedLocale = 'en' | 'zh'

const locales: LocaleObject<SupportedLocale>[] = [
  { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
  { code: 'zh', language: 'zh-TW', name: '繁體中文', file: 'zh.json' },
]

export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
    '@barzhsieh/nuxt-content-mermaid',
    '@nuxtjs/i18n',
  ],
  css: ['~/assets/css/main.css'],
  mdc: {
    highlight: {
      theme: {
        default: 'github-light',
        dark: 'github-dark-high-contrast',
      },
    },
  },
  nitro: {
    publicAssets: [
      {
        baseURL: '/assets',
        dir: brandAssetsDir,
      },
    ],
  },
  i18n: {
    locales,
    strategy: 'prefix_except_default',
    defaultLocale: 'en',
    detectBrowserLanguage: false,
  },
  compatibilityDate: '2025-11-24',
})
