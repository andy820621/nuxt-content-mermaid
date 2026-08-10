import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { setup, createPage, url } from '@nuxt/test-utils/e2e'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/custom-components')

describe('custom renderer/spinner/error components', async () => {
  await setup({
    rootDir,
    browser: true,
  })

  it('uses custom spinner while rendering and hides after success', { timeout: 20000 }, async () => {
    const page = await createPage()
    await page.goto(url('/'))

    const spinner = page.locator('#test-spinner')
    await spinner.waitFor({ state: 'visible', timeout: 5000 })

    // Wait for stubbed mermaid to finish
    await spinner.waitFor({ state: 'detached', timeout: 5000 })

    const svg = page.locator('#diagram-container svg#mock-svg')
    expect(await svg.isVisible()).toBe(true)
  })

  it('shows custom error component on render failure', { timeout: 20000 }, async () => {
    const page = await createPage()
    await page.goto(url('/'))

    await page.locator('#toggle-diagram').click()
    await page.waitForTimeout(1200)

    const runs = await page.evaluate(() => (window as { __mermaidRuns__?: Array<{ source: string, threw: boolean }> }).__mermaidRuns__ || [])
    expect(runs.some(r => r.threw)).toBe(true)

    const errorComponent = page.locator('#test-error')
    await errorComponent.waitFor({ state: 'visible', timeout: 5000 })
    expect(await errorComponent.textContent()).toContain('Custom Error Component')

    const codeBlock = errorComponent.locator('code')
    const text = await codeBlock.textContent()
    expect(text).toContain('__FORCE_ERROR__')
  })
})
