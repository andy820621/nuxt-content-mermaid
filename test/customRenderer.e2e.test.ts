import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { $fetch, setup, createPage, url } from '@nuxt/test-utils/e2e'
import { installDiagnosticCapture, readDiagnosticEvents } from './helpers/diagnosticCapture'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/custom-renderer')

async function releaseCustomRenderer(page: Awaited<ReturnType<typeof createPage>>) {
  await page.waitForFunction(() => {
    return !!(window as Window & {
      __customRendererResolution__?: { readonly pending: true }
    }).__customRendererResolution__?.pending
  })
  await page.evaluate(() => {
    (window as Window & {
      __customRendererResolution__?: { readonly resolve: () => void }
    }).__customRendererResolution__?.resolve()
  })
}

describe('custom renderer option', async () => {
  await setup({
    rootDir,
    browser: true,
  })

  it('renders only the neutral source and outer styling seam while selection is pending in SSR', async () => {
    const html = await $fetch<string>('/')

    expect(html).toContain('class="mermaid-outer-wrapper"')
    expect(html).toContain('graph TD;A--&gt;B;B--&gt;C;')
    expect(html).not.toContain('class="mermaid-block"')
    expect(html).not.toContain('class="mermaid-toolbar"')
    expect(html).not.toContain('class="mermaid-wrapper"')
    expect(html).not.toContain('mermaid-error-default')
  })

  it('keeps neutral source visible without Built-in lifecycle during client-side pending', { timeout: 20000 }, async () => {
    const page = await createPage()
    const hydrationMessages: string[] = []
    page.on('console', (message) => {
      if (/hydration/i.test(message.text())) hydrationMessages.push(message.text())
    })
    await installDiagnosticCapture(page)
    await page.goto(url('/'), { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => {
      return !!(window as Window & {
        __customRendererResolution__?: { readonly pending: true }
      }).__customRendererResolution__?.pending
    })

    const outer = page.locator('#diagram-container .mermaid-outer-wrapper')
    expect(await outer.textContent()).toContain('graph TD;A-->B;B-->C;')
    expect(await outer.locator('.mermaid-block').count()).toBe(0)
    expect(await outer.locator('.mermaid-toolbar').count()).toBe(0)
    expect(await outer.locator('.mermaid-wrapper').count()).toBe(0)
    expect(await outer.getByTestId('renderer-spinner').count()).toBe(0)
    expect(await readDiagnosticEvents(page)).not.toContain('renderer:create')
    expect(hydrationMessages).toEqual([])

    await releaseCustomRenderer(page)
  })

  it('renders via custom renderer and uses custom spinner', { timeout: 20000 }, async () => {
    const page = await createPage()
    await installDiagnosticCapture(page)
    await page.goto(url('/'), { waitUntil: 'domcontentloaded' })

    // Reset any previous run records (other fixtures may have set them)
    await page.evaluate(() => {
      (window as { __mermaidRuns__?: Array<{ source: string }> }).__mermaidRuns__ = []
    })
    await releaseCustomRenderer(page)

    const codeDiagram = page.locator('#diagram-container')
    const spinner = codeDiagram.getByTestId('renderer-spinner')
    await spinner.waitFor({ state: 'visible', timeout: 5000 })

    // Wait for custom renderer to finish
    await spinner.waitFor({ state: 'detached', timeout: 5000 })

    const output = codeDiagram.getByTestId('renderer-output')
    await output.waitFor({ state: 'visible', timeout: 5000 })
    expect(await output.textContent()).toContain('Rendered: graph TD;A-->B;B-->C;')
    expect(await codeDiagram.getByTestId('renderer-attrs').textContent()).toBe('')
    expect(await codeDiagram.getByTestId('renderer-slots').textContent()).toBe('default')
    const slotSource = page.locator('#slot-diagram [data-testid="renderer-slot-source"]')
    await slotSource.waitFor({ state: 'visible', timeout: 5000 })
    expect(await slotSource.textContent()).toBe('graph TD;A-->B;B-->C;')

    // Custom renderer does not output built-in SVG from mermaid.run
    const svg = page.locator('#diagram-container svg')
    expect(await svg.count()).toBe(0)

    const builtInRunCount = await page.evaluate(() => {
      return (window as Window & { __builtInMermaidRunCount__?: number }).__builtInMermaidRunCount__ || 0
    })
    expect(builtInRunCount).toBe(0)

    const diagnosticEvents = await readDiagnosticEvents(page)
    expect(diagnosticEvents).not.toContain('renderer:create')
  })

  it('keeps ownership with the Custom Renderer after its mount fails', { timeout: 20000 }, async () => {
    const page = await createPage()
    await page.addInitScript(() => {
      (window as Window & {
        __customRendererFailureMode__?: 'mount'
      }).__customRendererFailureMode__ = 'mount'
    })
    await installDiagnosticCapture(page)
    await page.goto(url('/'), { waitUntil: 'domcontentloaded' })
    await releaseCustomRenderer(page)
    await page.waitForFunction(() => {
      return (window as Window & {
        __customRendererErrors__?: string[]
      }).__customRendererErrors__?.includes('Custom Renderer mount failed')
    })

    expect(await page.locator('.mermaid-block').count()).toBe(0)
    expect(await page.getByTestId('configured-error').count()).toBe(0)
    expect(await page.evaluate(() => {
      return (window as Window & { __builtInMermaidRunCount__?: number }).__builtInMermaidRunCount__ || 0
    })).toBe(0)
    expect(await readDiagnosticEvents(page)).not.toContain('renderer:create')
  })
})
