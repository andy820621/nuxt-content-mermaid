import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createPage, setup, url } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const websiteRoot = fileURLToPath(new URL('..', import.meta.url))
const homepageMarkdown = readFileSync(
  fileURLToPath(new URL('../content/1.index.md', import.meta.url)),
  'utf8',
)
const expectedSource = homepageMarkdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, '').trim()

describe('documentation website landing hero', async () => {
  await setup({
    rootDir: websiteRoot,
    browser: true,
  })

  it('shows the real render by default and exposes the exact Markdown source', async () => {
    const page = await createPage()
    await page.goto(url('/'))

    const sourceTab = page.getByRole('tab', { name: 'Markdown' })
    const previewTab = page.getByRole('tab', { name: 'Rendered UI' })
    const sourcePanel = page.getByRole('tabpanel', { name: 'Markdown' })
    const previewPanel = page.getByRole('tabpanel', { name: 'Rendered UI' })

    expect(await sourceTab.count()).toBe(1)
    expect(await previewTab.count()).toBe(1)
    expect(await previewTab.getAttribute('aria-selected')).toBe('true')
    expect(await previewPanel.isVisible()).toBe(true)
    expect(await sourcePanel.isVisible()).toBe(false)
    expect(await previewPanel.locator('.mermaid-block').count()).toBe(1)

    await sourceTab.click()

    expect(await sourceTab.getAttribute('aria-selected')).toBe('true')
    expect((await sourcePanel.textContent())?.trim()).toBe(expectedSource)
    expect(await previewPanel.isVisible()).toBe(false)
  })

  it('supports Arrow, Home, and End keyboard navigation', async () => {
    const page = await createPage()
    await page.goto(url('/'))

    const sourceTab = page.getByRole('tab', { name: 'Markdown' })
    const previewTab = page.getByRole('tab', { name: 'Rendered UI' })

    await previewTab.focus()
    await previewTab.press('ArrowLeft')
    expect(await sourceTab.getAttribute('aria-selected')).toBe('true')
    expect(await sourceTab.evaluate(element => element === document.activeElement)).toBe(true)

    await sourceTab.press('End')
    expect(await previewTab.getAttribute('aria-selected')).toBe('true')

    await previewTab.press('Home')
    expect(await sourceTab.getAttribute('aria-selected')).toBe('true')
  })

  it('contains source overflow at a 320px viewport in both themes', async () => {
    const page = await createPage()
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto(url('/'))
    await page.getByRole('tab', { name: 'Markdown' }).click()

    const overflow = await page.evaluate(() => {
      const source = document.querySelector<HTMLElement>('.landing-demo__panel--source pre')
      return {
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        sourceOverflow: source ? source.scrollWidth - source.clientWidth : -1,
        sourceOverflowStyle: source ? getComputedStyle(source).overflowX : null,
      }
    })

    expect(overflow.pageOverflow).toBeLessThanOrEqual(0)
    expect(overflow.sourceOverflow).toBeGreaterThanOrEqual(0)
    expect(overflow.sourceOverflowStyle).toBe('auto')

    await page.getByRole('button', { name: 'Switch to dark mode' }).click()
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })
})
