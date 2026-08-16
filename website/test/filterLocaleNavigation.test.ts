import type { ContentNavigationItem } from '@nuxt/content'
import { describe, expect, it } from 'vitest'
import type { SupportedLocale } from '../types/i18n'
import { filterLocaleNavigation } from '../utils/filterLocaleNavigation'

const navigation = [
  { path: '/', title: 'English home', children: [] },
  { path: '/getting-started', title: 'Getting Started', children: [] },
  {
    path: '/migration',
    title: 'Migration',
    page: false,
    children: [{ path: '/migration/v3', title: 'Migration to v3', children: [] }],
  },
  { path: '/zh', title: '中文首頁', children: [] },
  { path: '/zh/getting-started', title: '開始使用', children: [] },
  {
    path: '/zh/migration',
    title: '中文遷移',
    page: false,
    children: [{ path: '/zh/migration/v3', title: '升級至 v3', children: [] }],
  },
] as unknown as ContentNavigationItem[]

const supportedLocales = ['en', 'zh'] as const satisfies readonly SupportedLocale[]

describe('filterLocaleNavigation', () => {
  it('shares the supported locale contract', () => {
    expect(supportedLocales).toEqual(['en', 'zh'])
  })

  it('keeps English routes and nested groups for the default locale', () => {
    const result = filterLocaleNavigation(navigation, 'en')

    expect(result.map(item => item.path)).toEqual(['/', '/getting-started', '/migration'])
    expect(result[2]?.children?.map(item => item.path)).toEqual(['/migration/v3'])
  })

  it('keeps Chinese routes and nested groups for the zh locale', () => {
    const result = filterLocaleNavigation(navigation, 'zh')

    expect(result.map(item => item.path)).toEqual(['/zh', '/zh/getting-started', '/zh/migration'])
    expect(result[2]?.children?.map(item => item.path)).toEqual(['/zh/migration/v3'])
  })
})
