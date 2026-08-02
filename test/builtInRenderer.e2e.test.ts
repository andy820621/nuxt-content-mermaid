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
  }, expected)
}

async function releaseNext(page: BrowserPage) {
  await page.evaluate(() => {
    (window as MermaidTestWindow).__mermaidControl__?.releaseNext()
  })
}

async function waitForRuns(page: BrowserPage, expected: number) {
  await page.waitForFunction((count: number) => {
    return (window as MermaidTestWindow).__mermaidControl__?.runs.length === count
  }, expected)
}

async function waitForDiagnosticCount(page: BrowserPage, event: string, expected: number) {
  await page.waitForFunction(
    ({ eventName, count }: { eventName: string, count: number }) => {
      const events = (window as DiagnosticWindow).__mermaidDiagnosticEvents__ || []
      return events.filter(value => value === eventName).length >= count
    },
    { eventName: event, count: expected },
  )
}

async function renderInitialDiagram(page: BrowserPage) {
  await page.goto(url('/'))
  await page.getByTestId('built-in-spinner').waitFor({ state: 'visible', timeout: 5000 })
  await waitForPending(page, 1)
  await releaseNext(page)
  await page.locator('#primary svg[data-run-id="1"]').waitFor({ state: 'visible', timeout: 5000 })
  await page.getByTestId('built-in-spinner').waitFor({ state: 'detached', timeout: 5000 })
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

  it('keeps an existing error while recovery waits and clears it at attempt start', { timeout: 20000 }, async () => {
    const page = await createPage()
    await renderInitialDiagram(page)

    await page.locator('#primary-fail').click()
    await waitForRuns(page, 2)
    await releaseNext(page)

    const error = page.getByTestId('built-in-error')
    await error.waitFor({ state: 'visible', timeout: 5000 })
    expect(await error.getAttribute('data-same-error')).toBe('true')
    expect(await page.getByTestId('built-in-error-message').textContent()).toBe('Broken diagram')

    await page.locator('#blocker-mount').click()
    await waitForRuns(page, 3)
    await page.locator('#primary-recover').click()
    expect(await error.isVisible()).toBe(true)

    await releaseNext(page)
    await waitForRuns(page, 4)
    await error.waitFor({ state: 'detached', timeout: 5000 })
    await waitForPending(page, 1)
    await releaseNext(page)
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

  it('preserves first-completion-wins loading with multiple pending requests', { timeout: 20000 }, async () => {
    const page = await createPage()
    await installDiagnosticCapture(page)
    await renderInitialDiagram(page)

    await page.locator('#blocker-mount').click()
    await waitForRuns(page, 2)
    await releaseNext(page)
    await page.locator('#blocker svg[data-run-id="2"]').waitFor({ state: 'visible', timeout: 5000 })

    await page.locator('#primary-queue').click()
    await waitForRuns(page, 3)
    await page.locator('#blocker-update').click()
    await page.locator('#primary-queue').click()
    await waitForDiagnosticCount(page, 'queue:enqueue', 5)

    await releaseNext(page)
    await waitForRuns(page, 4)
    await waitForPending(page, 1)
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))

    await page.locator('#primary [aria-label="Expand diagram"]').click()
    await page.locator('.ncm-expand-modal').waitFor({ state: 'visible', timeout: 5000 })

    const activeInteraction = await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }))
      const modal = document.querySelector('.ncm-expand-modal')
      modal?.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true, cancelable: true }))
      const target = document.querySelector('.ncm-expand-target')
      target?.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }))
      return document.body.style.userSelect
    })
    expect(activeInteraction).toBe('none')
    await page.locator('.ncm-zoom-hint').waitFor({ state: 'visible', timeout: 2000 })

    await releaseNext(page)
    await waitForRuns(page, 5)
    await page.locator('.ncm-expand-modal').waitFor({ state: 'detached', timeout: 5000 })
    expect(await page.locator('.ncm-zoom-hint, .ncm-expand-target svg').count()).toBe(0)
    expect(await page.evaluate(() => {
      const wheel = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
      const key = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
      window.dispatchEvent(wheel)
      document.dispatchEvent(key)
      return {
        wheel: wheel.defaultPrevented,
        key: key.defaultPrevented,
        overflow: document.body.style.overflow,
        width: document.body.style.width,
        userSelect: document.body.style.userSelect,
      }
    })).toEqual({ wheel: false, key: false, overflow: '', width: '', userSelect: '' })
    await releaseNext(page)
    await page.locator('#primary svg[data-run-id="5"]').waitFor({ state: 'visible', timeout: 5000 })
  })
})
