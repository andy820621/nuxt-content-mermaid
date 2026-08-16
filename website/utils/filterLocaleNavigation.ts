import type { ContentNavigationItem } from '@nuxt/content'

export type SupportedLocale = 'en' | 'zh'

function belongsToLocale(path: string | undefined, locale: SupportedLocale) {
  if (!path)
    return false

  if (locale === 'en')
    return path === '/' || !path.startsWith('/zh')

  return path === '/zh' || path.startsWith('/zh/')
}

export function filterLocaleNavigation(
  items: ContentNavigationItem[],
  locale: SupportedLocale,
): ContentNavigationItem[] {
  return items.flatMap((item) => {
    const children = filterLocaleNavigation(item.children ?? [], locale)
    const matches = belongsToLocale(item.path, locale)

    if (!matches && children.length === 0)
      return []

    return [{ ...item, children }]
  })
}
