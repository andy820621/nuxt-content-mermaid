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
})
