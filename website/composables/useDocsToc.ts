import type { TocLink } from '@nuxt/content'
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'

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

const observerOptions: IntersectionObserverInit = {
  rootMargin: '0px 0px -80% 0px',
  threshold: [0, 0.25, 0.5, 0.75, 1],
}

export function useDocsToc(
  getLinks: () => TocLink[],
  getRouteKey: () => string,
) {
  const flatLinks = computed(() => flattenTocLinks(getLinks()))
  const linkSignature = computed(() => flatLinks.value.map(link => link.id).join('\u0000'))
  const state = shallowRef<TocScrollspyState>({
    activeIds: new Set(),
    lastActiveId: undefined,
  })
  let observer: IntersectionObserver | undefined

  function disconnect() {
    observer?.disconnect()
    observer = undefined
  }

  function isActive(id: string): boolean {
    const current = state.value
    return current.activeIds.size > 0
      ? current.activeIds.has(id)
      : current.lastActiveId === id
  }

  async function observeHeadings() {
    await nextTick()
    disconnect()

    const headings = resolveTocHeadingElements(
      flatLinks.value.map(link => link.id),
      id => document.getElementById(id),
    )
    const initialActiveId = selectInitialTocId(
      headings.map(heading => ({ id: heading.id, top: heading.getBoundingClientRect().top })),
      window.innerHeight * 0.2,
    )

    state.value = {
      activeIds: new Set(initialActiveId ? [initialActiveId] : []),
      lastActiveId: initialActiveId,
    }

    observer = new IntersectionObserver((entries) => {
      state.value = updateTocVisibility(
        state.value,
        entries.map(entry => ({
          id: entry.target.id,
          isIntersecting: entry.isIntersecting,
        })),
      )
    }, observerOptions)

    headings.forEach(heading => observer?.observe(heading))
  }

  onMounted(observeHeadings)
  watch([getRouteKey, linkSignature], observeHeadings, { flush: 'post' })
  onBeforeUnmount(disconnect)

  return { flatLinks, isActive }
}
