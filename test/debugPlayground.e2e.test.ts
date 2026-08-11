import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createPage, setup, url } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../playground')

describe('debug playground', async () => {
  await setup({
    rootDir,
    browser: true,
  })

  it('renders adjacent diagrams while presenting the parser error and full diagnostics', { timeout: 30000 }, async () => {
    const page = await createPage()
    const response = await page.goto(url('/test-debug'))
    expect(response?.status()).toBe(200)

    const blockAfterHeading = (headingId: string) => page
      .locator(`#${headingId}`)
      .locator('xpath=following-sibling::*[1]')
      .locator('.mermaid-block')

    const normalBlock = blockAfterHeading('normal-chart-should-log-render-time')
    const syntaxErrorBlock = blockAfterHeading('syntax-error-chart-should-display-full-error-stack')
    const queuedBlock = blockAfterHeading('another-normal-chart-test-queue-mechanism')

    await normalBlock.locator('.mermaid > svg').waitFor({ state: 'visible', timeout: 10000 })
    await syntaxErrorBlock.locator('.mermaid-error').waitFor({ state: 'visible', timeout: 10000 })
    await queuedBlock.scrollIntoViewIfNeeded()
    await queuedBlock.locator('.mermaid > svg').waitFor({ state: 'visible', timeout: 10000 })

    expect(await syntaxErrorBlock.locator('.mermaid > svg').count()).toBe(0)
    expect(await syntaxErrorBlock.locator('.mermaid-error__stack').textContent()).toContain('Parse error')
    expect(await syntaxErrorBlock.locator('details code').textContent()).toContain('A --')
  })
})
