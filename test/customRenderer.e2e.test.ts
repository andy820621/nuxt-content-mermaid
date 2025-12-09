import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { setup, createPage, url } from '@nuxt/test-utils/e2e'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/custom-renderer')

describe('custom renderer option', async () => {
  await setup({
    rootDir,
    browser: true,
  })

  it('renders via custom renderer and uses custom spinner', { timeout: 20000 }, async () => {
    const page = await createPage()
    await page.goto(url('/'))

    // Reset any previous run records (other fixtures may have set them)
    await page.evaluate(() => {
      (window as { __mermaidRuns__?: Array<{ source: string }> }).__mermaidRuns__ = []
    })

    const spinner = page.getByTestId('renderer-spinner')
    await spinner.waitFor({ state: 'visible', timeout: 5000 })

    // Wait for custom renderer to finish
    await spinner.waitFor({ state: 'detached', timeout: 5000 })

    const output = page.getByTestId('renderer-output')
    await output.waitFor({ state: 'visible', timeout: 5000 })
    expect(await output.textContent()).toContain('Rendered:')

    // Custom renderer does not output built-in SVG from mermaid.run
    const svg = page.locator('#diagram-container svg')
    expect(await svg.count()).toBe(0)
  })
})
