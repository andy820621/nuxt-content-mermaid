import type { LocaleObject } from '@nuxtjs/i18n'
import { fileURLToPath } from 'node:url'
import type { SupportedLocale } from './types/i18n'

const brandAssetsDir = fileURLToPath(new URL('../src/assets', import.meta.url))

const locales: LocaleObject<SupportedLocale>[] = [
  { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
  { code: 'zh', language: 'zh-TW', name: '繁體中文', file: 'zh.json' },
]

export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
    '@barzhsieh/nuxt-content-mermaid',
    '@nuxtjs/i18n',
    '@nuxtjs/color-mode',
    '@nuxt/icon',
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
  colorMode: {
    preference: 'system',
    fallback: 'light',
    dataValue: 'theme',
    storageKey: 'nuxt-content-mermaid-color-mode',
  },
  compatibilityDate: '2025-11-24',
})
