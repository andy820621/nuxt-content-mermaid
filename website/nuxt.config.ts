import type { LocaleObject } from '@nuxtjs/i18n'
import { fileURLToPath } from 'node:url'
import type { SupportedLocale } from './types/i18n'
import { PUBLIC_ROUTES, SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN, toSiteURL } from './utils/site'

const brandAssetsDir = fileURLToPath(new URL('../src/assets', import.meta.url))

const locales: LocaleObject<SupportedLocale>[] = [
  { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
  { code: 'zh', language: 'zh-TW', name: '繁體中文', file: 'zh.json' },
]

export default defineNuxtConfig({
  modules: [
    '@nuxtjs/seo',
    '@nuxt/content',
    '@barzhsieh/nuxt-content-mermaid',
    '@nuxtjs/i18n',
    'nuxt-ai-ready',
    '@nuxtjs/color-mode',
    '@nuxt/icon',
  ],
  css: ['~/assets/css/main.css'],
  site: {
    name: SITE_NAME,
    url: SITE_ORIGIN,
    description: SITE_DESCRIPTION,
    trailingSlash: false,
    titleSeparator: '·',
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
  aiReady: {
    contentNegotiation: false,
    contentSource: true,
    database: false,
    runtimeSync: false,
    cron: false,
    apiCatalog: false,
    contentSignal: false,
    webmcp: false,
    agentSkills: false,
    mcpServerCard: false,
    mcp: {
      tools: false,
      resources: false,
    },
    autoI18n: true,
    llmsTxt: {
      markdownLinks: true,
      notes: 'Official English and Traditional Chinese documentation for Nuxt Content Mermaid.',
    },
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
  linkChecker: {
    runOnBuild: true,
    failOnError: true,
    fetchRemoteUrls: false,
  },
  ogImage: {
    enabled: false,
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
  seo: {
    minify: false,
    meta: {
      ogImage: toSiteURL('/assets/nuxt-content-mermaid.png'),
      ogImageAlt: SITE_NAME,
      twitterCard: 'summary_large_image',
      twitterImage: toSiteURL('/assets/nuxt-content-mermaid.png'),
      twitterImageAlt: SITE_NAME,
    },
  },
  sitemap: {
    autoI18n: false,
    excludeAppSources: true,
    urls: [...PUBLIC_ROUTES],
    xsl: false,
    zeroRuntime: true,
  },
})
