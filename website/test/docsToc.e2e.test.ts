import { fileURLToPath } from 'node:url'
import { createPage, setup, url } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const websiteRoot = fileURLToPath(new URL('..', import.meta.url))

async function createDocsPage(path = '/configuration') {
  const page = await createPage(undefined, {
    colorScheme: 'light',
    storageState: { cookies: [], origins: [] },
  })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(url(path), { waitUntil: 'hydration' })
  return page
}

async function waitForActiveHash(
  page: Awaited<ReturnType<typeof createPage>>,
  hash: string,
) {
  await page.waitForFunction(expectedHash =>
    [...document.querySelectorAll('.docs-toc-link[aria-current="location"]')]
      .some(link => link.getAttribute('href') === expectedHash),
  hash)
}

describe('documentation page TOC', async () => {
  await setup({
    rootDir: websiteRoot,
    browser: true,
  })

  it('seeds the first section and follows scrolling and native hash navigation', async () => {
    const page = await createDocsPage()
    const toc = page.getByRole('navigation', { name: 'On this page' })

    await waitForActiveHash(page, '#general')
    expect(await toc.getByRole('link', { name: 'General' }).getAttribute('aria-current')).toBe('location')

    await page.locator('#theme').evaluate(element => element.scrollIntoView())
    await waitForActiveHash(page, '#theme')

    await toc.getByRole('link', { name: 'Custom components' }).click()
    await page.waitForURL(/#custom-components$/)
    await waitForActiveHash(page, '#custom-components')
  })

  it('seeds a direct heading hash and rebinds after document route navigation', async () => {
    const page = await createDocsPage('/configuration#toolbar')

    await waitForActiveHash(page, '#toolbar')
    await page.locator('.docs-sidebar').getByRole('link', { name: 'Writing Diagrams' }).click()
    await page.waitForURL(/\/writing-diagrams$/)
    await waitForActiveHash(page, '#mermaid-fences')

    const toc = page.getByRole('navigation', { name: 'On this page' })
    expect(await toc.getByRole('link', { name: 'Mermaid fences' }).count()).toBe(1)
    expect(await toc.getByRole('link', { name: 'General' }).count()).toBe(0)
    expect(await toc.locator('.docs-toc-link[aria-current="location"]').count()).toBe(1)
  })

  it('renders Mermaid fences when page config frontmatter is absent', async () => {
    const page = await createDocsPage('/zh')

    expect(await page.locator('.mermaid-block').count()).toBeGreaterThan(0)
  })

  it('renders a shared rail and a non-color-only active indicator in both themes', async () => {
    const page = await createDocsPage()
    await waitForActiveHash(page, '#general')

    const toc = page.getByRole('navigation', { name: 'On this page' })
    const active = toc.getByRole('link', { name: 'General' })
    const inactive = toc.getByRole('link', { name: 'Theme' })

    async function readStyles() {
      return {
        rail: await toc.locator('.docs-toc-list').evaluate((element) => {
          const style = getComputedStyle(element)
          return { color: style.borderInlineStartColor, width: style.borderInlineStartWidth }
        }),
        active: await active.evaluate((element) => {
          const style = getComputedStyle(element)
          const indicator = getComputedStyle(element, '::before')
          return {
            color: style.color,
            fontWeight: Number(style.fontWeight),
            indicatorColor: indicator.backgroundColor,
            indicatorWidth: indicator.width,
          }
        }),
        inactiveColor: await inactive.evaluate(element => getComputedStyle(element).color),
      }
    }

    const light = await readStyles()
    expect(light.rail.width).toBe('1px')
    expect(light.active.indicatorWidth).toBe('2px')
    expect(light.active.indicatorColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(light.active.color).not.toBe(light.inactiveColor)
    expect(light.active.fontWeight).toBeGreaterThanOrEqual(650)

    await page.getByRole('button', { name: 'Switch to dark mode' }).click()
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
    const dark = await readStyles()
    expect(dark.active.indicatorColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(dark.active.color).not.toBe(dark.inactiveColor)
  })

  it('keeps hover and focus distinct and hides the TOC below the desktop breakpoint', async () => {
    const page = await createDocsPage()
    const toc = page.getByRole('navigation', { name: 'On this page' })
    const link = toc.getByRole('link', { name: 'Theme' })
    const active = toc.getByRole('link', { name: 'General' })

    const inactiveColor = await link.evaluate(element => getComputedStyle(element).color)
    const activeColor = await active.evaluate(element => getComputedStyle(element).color)
    await link.hover()
    const hoverColor = await link.evaluate(element => getComputedStyle(element).color)
    expect(hoverColor).not.toBe(inactiveColor)
    expect(hoverColor).not.toBe(activeColor)

    await link.focus()
    expect(await link.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none')

    await page.setViewportSize({ width: 900, height: 900 })
    expect(await toc.isVisible()).toBe(false)
  })

  it('uses instant scrolling when reduced motion is requested', async () => {
    const page = await createPage(undefined, {
      colorScheme: 'light',
      storageState: { cookies: [], origins: [] },
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(url('/configuration'), { waitUntil: 'hydration' })

    expect(await page.locator('html').evaluate(element => getComputedStyle(element).scrollBehavior)).toBe('auto')
  })
})
