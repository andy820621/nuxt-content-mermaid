import type { TocLink } from '@nuxt/content'
import { describe, expect, it } from 'vitest'
import {
  flattenTocLinks,
  resolveTocHeadingElements,
  selectInitialTocId,
  updateTocVisibility,
} from '../composables/useDocsToc'

const nestedLinks = [
  {
    id: 'general',
    depth: 2,
    text: 'General',
    children: [
      {
        id: 'loading',
        depth: 3,
        text: 'Loading',
        children: [
          { id: 'lazy-loading', depth: 4, text: 'Lazy loading' },
        ],
      },
    ],
  },
  { id: 'theme', depth: 2, text: 'Theme' },
] satisfies TocLink[]

describe('documentation TOC state', () => {
  it('flattens arbitrary nesting in document order', () => {
    expect(flattenTocLinks(nestedLinks).map(link => link.id)).toEqual([
      'general',
      'loading',
      'lazy-loading',
      'theme',
    ])
  })

  it('seeds the last heading above the reading line and falls back to the first', () => {
    const headings = [
      { id: 'general', top: 80 },
      { id: 'loading', top: 160 },
      { id: 'theme', top: 320 },
    ]

    expect(selectInitialTocId(headings, 180)).toBe('loading')
    expect(selectInitialTocId(headings, 40)).toBe('general')
    expect(selectInitialTocId([], 180)).toBeUndefined()
  })

  it('tracks every heading in the reading band and retains the last one between bands', () => {
    const initial = { activeIds: new Set<string>(), lastActiveId: undefined }
    const visible = updateTocVisibility(initial, [
      { id: 'general', isIntersecting: true },
      { id: 'loading', isIntersecting: true },
    ])

    expect([...visible.activeIds]).toEqual(['general', 'loading'])
    expect(visible.lastActiveId).toBe('loading')

    const betweenSections = updateTocVisibility(visible, [
      { id: 'general', isIntersecting: false },
      { id: 'loading', isIntersecting: false },
    ])

    expect([...betweenSections.activeIds]).toEqual([])
    expect(betweenSections.lastActiveId).toBe('loading')
  })

  it('skips missing heading elements without disturbing document order', () => {
    const elements = new Map([
      ['general', { id: 'general' } as HTMLElement],
      ['theme', { id: 'theme' } as HTMLElement],
    ])

    expect(resolveTocHeadingElements(
      ['general', 'missing', 'theme'],
      id => elements.get(id) ?? null,
    ).map(element => element.id)).toEqual(['general', 'theme'])
  })
})
