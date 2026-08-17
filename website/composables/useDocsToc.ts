import type { TocLink } from '@nuxt/content'

export interface TocHeadingPosition {
  id: string
  top: number
}

export interface TocVisibilityChange {
  id: string
  isIntersecting: boolean
}

export interface TocScrollspyState {
  activeIds: ReadonlySet<string>
  lastActiveId?: string
}

export function flattenTocLinks(links: TocLink[]): TocLink[] {
  return links.flatMap(link => [
    link,
    ...flattenTocLinks(link.children ?? []),
  ])
}

export function selectInitialTocId(
  headings: TocHeadingPosition[],
  readingLine: number,
): string | undefined {
  return headings.reduce<string | undefined>(
    (selected, heading) => heading.top <= readingLine ? heading.id : selected,
    undefined,
  ) ?? headings[0]?.id
}

export function updateTocVisibility(
  state: TocScrollspyState,
  changes: TocVisibilityChange[],
): TocScrollspyState {
  const activeIds = new Set(state.activeIds)
  let lastActiveId = state.lastActiveId

  for (const change of changes) {
    if (change.isIntersecting) {
      activeIds.add(change.id)
      lastActiveId = change.id
    }
    else {
      activeIds.delete(change.id)
    }
  }

  return { activeIds, lastActiveId }
}

export function resolveTocHeadingElements(
  ids: string[],
  getElementById: (id: string) => HTMLElement | null,
): HTMLElement[] {
  return ids.flatMap((id) => {
    const element = getElementById(id)
    return element ? [element] : []
  })
}
