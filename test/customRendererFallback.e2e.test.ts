import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { $fetch, createPage, setup, url } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/custom-renderer-fallback')

describe('custom renderer fallback', async () => {
  await setup({
    rootDir,
    browser: true,
  })

  it('keeps pending neutral and starts Built-in rendering after resolution failure', { timeout: 20000 }, async () => {
    const html = await $fetch<string>('/')
    expect(html).toContain('class="mermaid-outer-wrapper"')
    expect(html).toContain('graph TD;A--&gt;B;')
    expect(html).not.toContain('class="mermaid-block"')
    expect(html).not.toContain('class="mermaid-toolbar"')
    expect(html).not.toContain('class="mermaid-wrapper"')

    const page = await createPage()
    const warnings: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'warning') warnings.push(message.text())
    })
    await page.goto(url('/'))

    await page.locator('#diagram-container .mermaid > svg').waitFor({ state: 'visible', timeout: 5000 })
    expect(await page.evaluate(() => {
      return (window as Window & { __builtInMermaidRunCount__?: number }).__builtInMermaidRunCount__ || 0
    })).toBe(1)
    expect(warnings.some(message => message.includes('Cannot find mermaid component: MissingRenderer'))).toBe(true)
  })
})
