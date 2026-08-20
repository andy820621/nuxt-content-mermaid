import type { LocaleObject } from '@nuxtjs/i18n'
import { fileURLToPath } from 'node:url'
import type { SupportedLocale } from './types/i18n'
import { PUBLIC_ROUTES, SITE_NAME, SITE_ORIGIN } from './utils/site'

const brandAssetsDir = fileURLToPath(new URL('../src/assets', import.meta.url))

const locales: LocaleObject<SupportedLocale>[] = [
  { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
  { code: 'zh', language: 'zh-TW', name: '繁體中文', file: 'zh.json' },
]

export default defineNuxtConfig({
  modules: [
    'nuxt-site-config',
    '@nuxtjs/robots',
    '@nuxtjs/sitemap',
    '@nuxt/content',
    '@barzhsieh/nuxt-content-mermaid',
    '@nuxtjs/i18n',
    '@nuxtjs/color-mode',
    '@nuxt/icon',
  ],
  css: ['~/assets/css/main.css'],
  site: {
    name: SITE_NAME,
    url: SITE_ORIGIN,
  },
  colorMode: {
    preference: 'system',
    fallback: 'light',
    dataValue: 'theme',
    storageKey: 'nuxt-content-mermaid-color-mode',
  },
  content: {
    build: {
      markdown: {
        remarkPlugins: {
          'remark-breaks': {},
        },
      },
    },
  },
  mdc: {
    highlight: {
      theme: {
        default: 'github-light',
        dark: 'github-dark-high-contrast',
      },
    },
  },
  compatibilityDate: '2025-11-24',
  nitro: {
    prerender: {
      autoSubfolderIndex: false,
      routes: [...PUBLIC_ROUTES, '/robots.txt', '/sitemap.xml'],
    },
    publicAssets: [
      {
        baseURL: '/assets',
        dir: brandAssetsDir,
      },
    ],
  },
  i18n: {
    baseUrl: SITE_ORIGIN,
    locales,
    strategy: 'prefix_except_default',
    defaultLocale: 'en',
    detectBrowserLanguage: false,
  },
  icon: {
    provider: 'none',
    clientBundle: {
      icons: [
        'line-md:sunny-outline',
        'line-md:moon',
        'line-md:sunny-outline-twotone-loop',
        'line-md:moon-twotone',
      ],
    },
  },
  robots: {
    sitemap: [`${SITE_ORIGIN}/sitemap.xml`],
    groups: [
      {
        userAgent: ['GPTBot', 'ClaudeBot', 'CCBot', 'Applebot-Extended'],
        disallow: ['/'],
      },
      {
        userAgent: ['*'],
        allow: ['/'],
        contentSignal: {
          'search': 'yes',
          'ai-input': 'yes',
          'ai-train': 'no',
        },
        contentUsage: {
          'bots': 'y',
          'search': 'y',
          'ai-output': 'y',
          'train-ai': 'n',
        },
      },
    ],
  },
  sitemap: {
    autoI18n: false,
    excludeAppSources: true,
    urls: [...PUBLIC_ROUTES],
    xsl: false,
    zeroRuntime: true,
  },
})
