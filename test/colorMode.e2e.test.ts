import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { setup, createPage, url } from '@nuxt/test-utils/e2e'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/color-mode')

describe('color mode theme switching', async () => {
  await setup({
    rootDir,
    browser: true,
  })

  it('re-initializes mermaid with dark theme when color mode changes', { timeout: 20000 }, async () => {
    type InitCall = { theme?: string }

    const page = await createPage()
    await page.goto(url('/'))

    await page.waitForTimeout(2000)

    const initial = await page.evaluate(() => {
      const calls = (window as { __mermaidInitCalls__?: InitCall[], __mockMermaidLoaded__?: boolean })
        .__mermaidInitCalls__ || []
      const loaded = (window as { __mockMermaidLoaded__?: boolean }).__mockMermaidLoaded__ || false
      return { themes: calls.map(c => c.theme), loaded }
    })

    expect(initial.loaded).toBe(true)
    expect(initial.themes.length).toBeGreaterThan(0)
    expect(initial.themes.at(-1)).toBe('default')

    await page.locator('#toggle-dark').click()
    await page.waitForTimeout(2000)

    const themes = await page.evaluate(() => {
      const calls = (window as { __mermaidInitCalls__?: InitCall[] }).__mermaidInitCalls__ || []
      return calls.map(c => c.theme)
    })

    expect(themes.at(-1)).toBe('dark')
  })
})
