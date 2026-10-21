import { fileURLToPath } from 'node:url'
import { createPage, setup, url } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const websiteRoot = fileURLToPath(new URL('..', import.meta.url))

describe('documentation Markdown line breaks', async () => {
  await setup({ rootDir: websiteRoot, browser: true })

  it('serves the localized migration page on direct navigation', async () => {
    const page = await createPage()
    const response = await page.goto(url('/zh/migration/v3'), { waitUntil: 'hydration' })

    expect(response?.status()).toBe(200)
    expect(await page.locator('#main-content h1').innerText()).toBe('升級至 v3')
  })

  it('renders a single authored newline as a line break', async () => {
    const page = await createPage(undefined, {
      colorScheme: 'light',
      storageState: { cookies: [], origins: [] },
    })

    await page.goto(url('/zh/writing-diagrams'), { waitUntil: 'hydration' })

    const introduction = page.locator('.docs-content p').filter({
      hasText: '使用 Nuxt Content 時',
    }).first()

    expect(await introduction.locator('br').count()).toBe(1)
    expect(await introduction.innerText()).toContain('元件。\n兩種方式預設都使用內建渲染器')
  })
})
