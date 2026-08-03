import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { $fetch, createPage, setup, url } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { installDiagnosticCapture, readDiagnosticEvents } from './helpers/diagnosticCapture'

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
    const messages: string[] = []
    await installDiagnosticCapture(page)
    page.on('console', (message) => {
      messages.push(message.text())
    })
    await page.goto(url('/'))

    await page.locator('#diagram-container .mermaid > svg').waitFor({ state: 'visible', timeout: 5000 })
    const runCount = await page.evaluate(() => {
      return (window as Window & { __builtInMermaidRunCount__?: number }).__builtInMermaidRunCount__ || 0
    })
    const events = await readDiagnosticEvents(page)

    expect(messages.some(message => (
      message.includes('[nuxt-content-mermaid]')
      && message.includes('MissingRenderer')
      && message.includes('not-found')
    ))).toBe(true)
    expect(events.filter(event => event === 'resolution-failed')).toHaveLength(1)
    expect(runCount).toBe(1)
    expect(await page.getByTestId('configured-error').count()).toBe(0)
  })
})
