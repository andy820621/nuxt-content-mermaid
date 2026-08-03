import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPage, setup, url } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { installDiagnosticCapture, readDiagnosticEvents } from './helpers/diagnosticCapture'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/custom-renderer-candidate-load-failed')

describe('custom renderer candidate load failure fallback', async () => {
  await setup({
    rootDir,
    browser: true,
  })

  it('reports before creating the Built-in fallback at debug true', { timeout: 20000 }, async () => {
    const page = await createPage()
    const messages: string[] = []
    await installDiagnosticCapture(page)
    page.on('console', message => messages.push(message.text()))
    await page.goto(url('/'))

    await page.locator('#diagram-container .mermaid > svg').waitFor({ state: 'visible', timeout: 5000 })
    const events = await readDiagnosticEvents(page)
    const diagnosticIndex = events.indexOf('resolution-failed')
    const factoryIndex = events.indexOf('renderer:create')
    const runCount = await page.evaluate(() => {
      return (window as Window & { __builtInMermaidRunCount__?: number }).__builtInMermaidRunCount__ || 0
    })

    expect(messages.some(message => (
      message.includes('[nuxt-content-mermaid]')
      && message.includes('BrokenRenderer')
      && message.includes('load-failed')
    ))).toBe(true)
    expect(messages.some(message => (
      message.includes('BrokenRenderer fixture failed during module load')
    ))).toBe(true)
    expect(diagnosticIndex).toBeGreaterThanOrEqual(0)
    expect(factoryIndex).toBeGreaterThan(diagnosticIndex)
    expect(events.filter(event => event === 'resolution-failed')).toHaveLength(1)
    expect(events.filter(event => event === 'renderer:create')).toHaveLength(1)
    expect(runCount).toBe(1)
    expect(await page.locator('#diagram-container .mermaid-block').count()).toBe(1)
    expect(await page.getByTestId('configured-error').count()).toBe(0)
  })
})
