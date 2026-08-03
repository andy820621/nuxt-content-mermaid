import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createPage, setup, url } from '@nuxt/test-utils/e2e'
import type { MermaidTestWindow } from './fixtures/built-in-renderer/types'
import { installDiagnosticCapture, readDiagnosticEvents } from './helpers/diagnosticCapture'
import type { DiagnosticWindow } from './helpers/diagnosticCapture'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/built-in-renderer')

type BrowserPage = Awaited<ReturnType<typeof createPage>>

async function waitForPending(page: BrowserPage, expected: number) {
  await page.waitForFunction((count: number) => {
    return (window as MermaidTestWindow).__mermaidControl__?.pending === count
  }, expected, { timeout: 5000 })
}

async function releaseNext(page: BrowserPage) {
  await page.evaluate(() => {
    (window as MermaidTestWindow).__mermaidControl__?.releaseNext()
  })
}

async function waitForRuns(page: BrowserPage, expected: number) {
  await page.waitForFunction((count: number) => {
    return (window as MermaidTestWindow).__mermaidControl__?.runs.length === count
  }, expected, { timeout: 5000 })
}

async function waitForComponentErrors(page: BrowserPage, expected: number) {
  await page.waitForFunction((count: number) => {
    return document.querySelector('#component-error')?.getAttribute('data-count') === String(count)
  }, expected, { timeout: 5000 })
}

async function waitForDiagnosticCount(page: BrowserPage, event: string, expected: number) {
  await page.waitForFunction(
    ({ eventName, count }: { eventName: string, count: number }) => {
      const events = (window as DiagnosticWindow).__mermaidDiagnosticEvents__ || []
      return events.filter(value => value === eventName).length >= count
    },
    { eventName: event, count: expected },
    { timeout: 5000 },
  )
}

async function installFullscreenStub(page: BrowserPage) {
  await page.addInitScript(() => {
    const defineWritable = (target: object, key: string, value: unknown) => {
      Object.defineProperty(target, key, { value, writable: true, configurable: true })
    }

    defineWritable(document, 'fullScreen', false)
    defineWritable(document, 'fullscreenElement', null)
    defineWritable(document, 'exitFullscreen', async () => {
      ;(document as { fullScreen?: boolean }).fullScreen = false
      ;(document as { fullscreenElement?: Element | null }).fullscreenElement = null
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    defineWritable(HTMLElement.prototype, 'requestFullscreen', async function (this: HTMLElement) {
      ;(document as { fullScreen?: boolean }).fullScreen = true
      ;(document as { fullscreenElement?: Element | null }).fullscreenElement = this
      document.dispatchEvent(new Event('fullscreenchange'))
    })
  })
}

async function renderInitialDiagram(page: BrowserPage) {
  await page.goto(url('/'))
  await page.getByTestId('built-in-spinner').waitFor({ state: 'visible', timeout: 5000 })
  await waitForPending(page, 1)
  await releaseNext(page)
  await page.locator('#primary svg[data-run-id="1"]').waitFor({ state: 'visible', timeout: 5000 })
  await page.getByTestId('built-in-spinner').waitFor({ state: 'detached', timeout: 5000 })
}

async function renderInitialReactiveConflictDiagram(page: BrowserPage) {
  await renderInitialDiagram(page)
  await page.locator('#reactive-conflict-mount').click()
  await waitForRuns(page, 2)
  await releaseNext(page)
  await page.locator('#reactive-conflict svg[data-run-id="2"]').waitFor({ state: 'visible', timeout: 5000 })
}

describe('built-in renderer integration', async () => {
  await setup({
    rootDir,
    browser: true,
  })

  it('starts loading at enqueue and renders through factory diagnostics', { timeout: 20000 }, async () => {
    const page = await createPage()
    await installDiagnosticCapture(page)
    await renderInitialDiagram(page)

    const events = await readDiagnosticEvents(page)
    expect(events).toEqual(expect.arrayContaining([
      'renderer:create',
      'queue:enqueue',
      'queue:start',
      'attempt:duration',
      'queue:finish',
    ]))
  })

  it('materializes a fresh Mermaid configuration for every render attempt', { timeout: 20000 }, async () => {
    const page = await createPage()
    await renderInitialDiagram(page)

    await page.locator('#primary-queue').click()
    await waitForRuns(page, 2)
    await releaseNext(page)
    await page.locator('#primary svg[data-run-id="2"]').waitFor({ state: 'visible', timeout: 5000 })

    expect(await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.reusedInitializationConfig
    })).toBe(false)
  })

  it('rejects an initial source conflict before creating render work', { timeout: 20000 }, async () => {
    const page = await createPage()
    await renderInitialDiagram(page)

    await page.locator('#conflict-mount').click()
    const fingerprint = page.locator('#component-error')
    await fingerprint.waitFor({ state: 'attached', timeout: 5000 })

    expect(await fingerprint.getAttribute('data-name')).toBe('MermaidComponentConfigurationError')
    expect(await fingerprint.getAttribute('data-code')).toBe('CONTENT_MERMAID_COMPONENT_CONFIGURATION_ERROR')
    expect(await fingerprint.getAttribute('data-count')).toBe('1')
    expect(await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.runs.length
    })).toBe(1)

    await page.locator('#conflict-resolve').click()
    await page.evaluate(async () => {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    })
    expect(await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.runs.length
    })).toBe(1)
  })

  it('renders runtime-only and Page Mermaid Config sources through the shared seam', { timeout: 20000 }, async () => {
    const page = await createPage()
    await renderInitialDiagram(page)

    await page.locator('#page-config-mount').click()
    await waitForRuns(page, 2)

    const runs = await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.runs
    })
    expect(runs?.[0]).toEqual(expect.objectContaining({
      theme: 'default',
      securityLevel: 'strict',
      unknownMermaidExtensionEnabled: false,
    }))
    expect(runs?.[1]).toEqual(expect.objectContaining({
      theme: 'forest',
      securityLevel: 'strict',
      unknownMermaidExtensionEnabled: true,
    }))

    await releaseNext(page)
    await page.locator('#page-config svg[data-run-id="2"]').waitFor({ state: 'visible', timeout: 5000 })
  })

  it('does not traverse provider-owned Direct Mermaid Config capabilities', { timeout: 20000 }, async () => {
    const page = await createPage()
    await renderInitialDiagram(page)

    await page.locator('#direct-capability-mount').click()
    await waitForRuns(page, 2)

    expect(await page.locator('#opaque-capability-inspections').getAttribute('data-count')).toBe('0')
    expect(await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.runs[1]
    })).toEqual(expect.objectContaining({
      directCapabilityFontSize: 16,
      directOpenValue: 'preserved',
      directSharedReferencePreserved: true,
    }))

    await releaseNext(page)
    await page.locator('#direct-capability svg[data-run-id="2"]').waitFor({ state: 'visible', timeout: 5000 })
  })

  it('rejects unsupported Direct Mermaid Config before creating render work', { timeout: 20000 }, async () => {
    const page = await createPage()
    await renderInitialDiagram(page)

    await page.locator('#invalid-direct-config-mount').click()
    const fingerprint = page.locator('#component-error')
    await fingerprint.waitFor({ state: 'attached', timeout: 5000 })

    expect(await fingerprint.getAttribute('data-name')).toBe('MermaidComponentConfigurationError')
    expect(await fingerprint.getAttribute('data-code')).toBe('CONTENT_MERMAID_COMPONENT_CONFIGURATION_ERROR')
    expect(await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.runs.length
    })).toBe(1)
  })

  it('renders Content-authored Markdown through the Page Mermaid Config protocol', { timeout: 20000 }, async () => {
    const page = await createPage()
    await renderInitialDiagram(page)

    expect(await page.locator('#markdown-page-status').getAttribute('data-loaded')).toBe('true')
    await page.locator('#markdown-page-config-mount').click()
    await waitForRuns(page, 2)

    const markdownRun = await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.runs[1]
    })
    expect(markdownRun).toEqual(expect.objectContaining({
      source: expect.stringContaining('MARKDOWN_PAGE_CONFIG'),
      theme: 'forest',
      securityLevel: 'strict',
      unknownMermaidExtensionEnabled: true,
    }))

    await releaseNext(page)
    await page.locator('#markdown-page-config svg[data-run-id="2"]').waitFor({ state: 'visible', timeout: 5000 })
  })

  it('revalidates reactive Page Mermaid Config updates through the shared seam', { timeout: 20000 }, async () => {
    const page = await createPage()
    await renderInitialDiagram(page)
    await page.locator('#page-config-mount').click()
    await waitForRuns(page, 2)
    await releaseNext(page)
    await page.locator('#page-config svg[data-run-id="2"]').waitFor({ state: 'visible', timeout: 5000 })

    await page.locator('#page-config-invalidate').click()
    const fingerprint = page.locator('#component-error')
    await fingerprint.waitFor({ state: 'attached', timeout: 5000 })

    expect(await fingerprint.getAttribute('data-name')).toBe('MermaidComponentConfigurationError')
    expect(await fingerprint.getAttribute('data-code')).toBe('CONTENT_MERMAID_COMPONENT_CONFIGURATION_ERROR')
    expect(await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.runs.length
    })).toBe(2)
  })

  it('returns a reactive Page Mermaid Config invocation to runtime-only', { timeout: 20000 }, async () => {
    const page = await createPage()
    await renderInitialDiagram(page)
    await page.locator('#page-config-mount').click()
    await waitForRuns(page, 2)
    await releaseNext(page)
    await page.locator('#page-config svg[data-run-id="2"]').waitFor({ state: 'visible', timeout: 5000 })

    await page.locator('#page-config-remove').click()
    await waitForRuns(page, 3)
    const latestRun = await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.runs[2]
    })
    expect(latestRun).toEqual(expect.objectContaining({
      theme: 'default',
      securityLevel: 'strict',
      unknownMermaidExtensionEnabled: false,
    }))

    await releaseNext(page)
    await page.locator('#page-config svg[data-run-id="3"]').waitFor({ state: 'visible', timeout: 5000 })
  })

  it('reports once per reactive conflict episode and recovers exactly once with the latest state', { timeout: 20000 }, async () => {
    const page = await createPage()
    await renderInitialReactiveConflictDiagram(page)

    await page.locator('#reactive-conflict-enter').click()
    await waitForComponentErrors(page, 1)
    const fingerprint = page.locator('#component-error')
    expect(await fingerprint.getAttribute('data-name')).toBe('MermaidComponentConfigurationError')
    expect(await fingerprint.getAttribute('data-code')).toBe('CONTENT_MERMAID_COMPONENT_CONFIGURATION_ERROR')
    await page.locator('#reactive-conflict-update').click()
    await page.evaluate(async () => {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    })

    expect(await page.locator('#component-error').getAttribute('data-count')).toBe('1')
    expect(await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.runs.length
    })).toBe(2)

    await page.locator('#reactive-conflict-recover').click()
    await waitForRuns(page, 3)
    expect(await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.runs[2]
    })).toEqual(expect.objectContaining({
      source: expect.stringContaining('RECOVERED_LATEST'),
      theme: 'dark',
    }))
    await releaseNext(page)
    await page.locator('#reactive-conflict svg[data-run-id="3"]').waitFor({ state: 'visible', timeout: 5000 })
    expect(await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.runs.length
    })).toBe(3)

    await page.locator('#reactive-conflict-reenter').click()
    await waitForComponentErrors(page, 2)
    expect(await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.runs.length
    })).toBe(3)
  })

  it('invalidates an executing generation without changing committed or fullscreen state', { timeout: 20000 }, async () => {
    const page = await createPage()
    await installFullscreenStub(page)
    await renderInitialReactiveConflictDiagram(page)

    await page.locator('#reactive-conflict [aria-label="Enter fullscreen"]').click()
    await page.locator('#reactive-conflict .ncm-zoom-toolbar--fullscreen').waitFor({ state: 'visible', timeout: 5000 })
    await page.locator('#reactive-conflict-queue').click()
    await waitForRuns(page, 3)

    await page.locator('#reactive-conflict-enter').click()
    await waitForComponentErrors(page, 1)
    await releaseNext(page)
    await waitForPending(page, 0)

    expect(await page.locator('#reactive-conflict .mermaid > svg').getAttribute('data-run-id')).toBe('2')
    expect(await page.locator('#reactive-conflict [data-testid="built-in-error"]').count()).toBe(0)
    await page.locator('#reactive-conflict .ncm-zoom-toolbar--fullscreen').waitFor({ state: 'visible', timeout: 5000 })
    expect(await page.evaluate(() => document.fullscreenElement !== null)).toBe(true)
  })

  it('invalidates a queued first generation and recovers its first render once', { timeout: 20000 }, async () => {
    const page = await createPage()
    await installDiagnosticCapture(page)
    await renderInitialDiagram(page)
    await page.locator('#blocker-mount').click()
    await waitForRuns(page, 2)

    await page.locator('#reactive-conflict-mount').click()
    await waitForDiagnosticCount(page, 'queue:enqueue', 3)
    const spinner = page.locator('#reactive-conflict [data-testid="built-in-spinner"]')
    await spinner.waitFor({ state: 'visible', timeout: 5000 })

    await page.locator('#reactive-conflict-enter').click()
    await waitForComponentErrors(page, 1)
    await spinner.waitFor({ state: 'detached', timeout: 5000 })
    await releaseNext(page)
    await waitForDiagnosticCount(page, 'queue:finish', 3)

    expect(await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.runs.length
    })).toBe(2)
    expect(await page.locator('#reactive-conflict .mermaid > svg').count()).toBe(0)
    expect(await page.locator('#reactive-conflict [data-testid="built-in-error"]').count()).toBe(0)

    await page.locator('#reactive-conflict-recover').click()
    await waitForRuns(page, 3)
    expect(await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.runs[2]
    })).toEqual(expect.objectContaining({
      source: expect.stringContaining('RECOVERED_LATEST'),
      theme: 'dark',
    }))
    await releaseNext(page)
    await page.locator('#reactive-conflict svg[data-run-id="3"]').waitFor({ state: 'visible', timeout: 5000 })
    expect(await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.runs.length
    })).toBe(3)
  })

  it('preserves the Committed Diagram through failure and pending recovery', { timeout: 20000 }, async () => {
    const page = await createPage()
    await installDiagnosticCapture(page)
    await renderInitialDiagram(page)

    await page.locator('#primary-fail').click()
    await waitForRuns(page, 2)
    await releaseNext(page)

    const error = page.getByTestId('built-in-error')
    await error.waitFor({ state: 'visible', timeout: 5000 })
    expect(await error.getAttribute('data-same-error')).toBe('true')
    expect(await page.getByTestId('built-in-error-message').textContent()).toBe('Broken diagram')
    expect(await page.locator('#primary .mermaid > svg').getAttribute('data-run-id')).toBe('1')

    await page.locator('#primary-recover').click()
    await waitForRuns(page, 3)
    await page.locator('#primary-queue').click()
    await waitForDiagnosticCount(page, 'queue:enqueue', 4)

    await releaseNext(page)
    await waitForRuns(page, 4)
    await waitForPending(page, 1)
    expect(await error.isVisible()).toBe(true)
    expect(await page.locator('#primary .mermaid > svg').getAttribute('data-run-id')).toBe('1')

    await releaseNext(page)
    await error.waitFor({ state: 'detached', timeout: 5000 })
    await page.locator('#primary svg[data-run-id="4"]').waitFor({ state: 'visible', timeout: 5000 })
  })

  it('skips a queued request whose latest source is empty', { timeout: 20000 }, async () => {
    const page = await createPage()
    await installDiagnosticCapture(page)
    await renderInitialDiagram(page)
    await waitForDiagnosticCount(page, 'queue:finish', 1)

    await page.locator('#blocker-mount').click()
    await waitForRuns(page, 2)

    await page.locator('#skipped-mount').click()
    await waitForDiagnosticCount(page, 'queue:enqueue', 3)
    const skippedSpinner = page.locator('#skipped [data-testid="built-in-spinner"]')
    await skippedSpinner.waitFor({ state: 'visible', timeout: 5000 })
    await page.locator('#skipped-clear').click()

    await releaseNext(page)
    await waitForDiagnosticCount(page, 'queue:finish', 3)
    await skippedSpinner.waitFor({ state: 'detached', timeout: 5000 })

    const runs = await page.evaluate(() => {
      return (window as MermaidTestWindow).__mermaidControl__?.runs || []
    })
    expect(runs).toHaveLength(2)
    expect(await page.locator('#skipped [data-testid="built-in-error"]').count()).toBe(0)
  })

  it('commits strict SVG and sandbox iframe output from cleaned staging hosts', { timeout: 20000 }, async () => {
    const page = await createPage()
    await renderInitialDiagram(page)

    await page.locator('#strict-mount').click()
    await waitForRuns(page, 2)
    await releaseNext(page)
    await page.locator('#strict .mermaid > svg[data-run-id="2"]').waitFor({ state: 'visible', timeout: 5000 })

    await page.locator('#sandbox-mount').click()
    await waitForRuns(page, 3)
    await releaseNext(page)
    await page.locator('#sandbox .mermaid > iframe[data-run-id="3"]').waitFor({ state: 'visible', timeout: 5000 })

    const staging = await page.evaluate(() => {
      const control = (window as MermaidTestWindow).__mermaidControl__
      return {
        runs: control?.runs,
        allRootsRemoved: control?.stagingRoots.every(root => !root.isConnected),
      }
    })

    expect(staging.runs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 2,
        securityLevel: 'strict',
        stagingConnected: true,
        stagingHidden: true,
        stagingInert: true,
        stagingOutsideLiveSubtree: true,
      }),
      expect.objectContaining({
        id: 3,
        securityLevel: 'sandbox',
        stagingConnected: true,
        stagingHidden: true,
        stagingInert: true,
        stagingOutsideLiveSubtree: true,
      }),
    ]))
    expect(staging.allRootsRemoved).toBe(true)
  })

  it('keeps presentation state until only the latest generation commits', { timeout: 20000 }, async () => {
    const page = await createPage()
    await installDiagnosticCapture(page)
    await renderInitialDiagram(page)

    await page.locator('#primary [aria-label="Expand diagram"]').click()
    await page.locator('.ncm-expand-modal').waitFor({ state: 'visible', timeout: 5000 })

    await page.locator('#primary-queue').evaluate((button: HTMLButtonElement) => button.click())
    await waitForRuns(page, 2)
    await page.locator('#primary-queue').evaluate((button: HTMLButtonElement) => button.click())
    await waitForDiagnosticCount(page, 'queue:enqueue', 3)

    await releaseNext(page)
    await waitForRuns(page, 3)
    await waitForPending(page, 1)
    await page.locator('.ncm-expand-modal').waitFor({ state: 'visible', timeout: 5000 })
    expect(await page.locator('#primary .mermaid > svg').getAttribute('data-run-id')).toBe('1')

    await releaseNext(page)
    await page.locator('.ncm-expand-modal').waitFor({ state: 'detached', timeout: 5000 })
    await page.locator('#primary svg[data-run-id="3"]').waitFor({ state: 'visible', timeout: 5000 })
  })

  it('keeps the latest loading gate while a stale attempt finishes', { timeout: 20000 }, async () => {
    const page = await createPage()
    await installDiagnosticCapture(page)
    await renderInitialDiagram(page)

    await page.locator('#primary-queue').click()
    await waitForRuns(page, 2)
    await page.locator('#primary-queue').click()
    await waitForDiagnosticCount(page, 'queue:enqueue', 3)

    await releaseNext(page)
    await waitForRuns(page, 3)
    await waitForPending(page, 1)
    await page.locator('#primary [aria-label="Expand diagram"]').click()
    expect(await page.locator('.ncm-expand-modal').count()).toBe(0)
    expect(await page.locator('#primary .mermaid > svg').getAttribute('data-run-id')).toBe('1')

    await releaseNext(page)
    await page.locator('#primary svg[data-run-id="3"]').waitFor({ state: 'visible', timeout: 5000 })
    await page.locator('#primary [aria-label="Expand diagram"]').click()
    await page.locator('.ncm-expand-modal').waitFor({ state: 'visible', timeout: 5000 })
  })

  it('keeps fullscreen presentation until the latest generation commits', { timeout: 20000 }, async () => {
    const page = await createPage()
    await installDiagnosticCapture(page)
    await installFullscreenStub(page)
    await renderInitialDiagram(page)

    await page.locator('#primary [aria-label="Enter fullscreen"]').click()
    await page.locator('#primary .ncm-zoom-toolbar--fullscreen').waitFor({ state: 'visible', timeout: 5000 })

    await page.locator('#primary-queue').evaluate((button: HTMLButtonElement) => button.click())
    await waitForRuns(page, 2)
    await page.locator('#primary-queue').evaluate((button: HTMLButtonElement) => button.click())
    await waitForDiagnosticCount(page, 'queue:enqueue', 3)

    await releaseNext(page)
    await waitForRuns(page, 3)
    await waitForPending(page, 1)
    await page.locator('#primary .ncm-zoom-toolbar--fullscreen').waitFor({ state: 'visible', timeout: 5000 })
    expect(await page.evaluate(() => document.fullscreenElement !== null)).toBe(true)
    expect(await page.locator('#primary .mermaid > svg').getAttribute('data-run-id')).toBe('1')

    await releaseNext(page)
    await page.locator('#primary .ncm-zoom-toolbar--fullscreen').waitFor({ state: 'detached', timeout: 5000 })
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull()
    await page.locator('#primary svg[data-run-id="3"]').waitFor({ state: 'visible', timeout: 5000 })
  })
})
