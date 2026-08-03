import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createPage, setup, url } from '@nuxt/test-utils/e2e'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/lazy-conflict')

type LazyConflictWindow = Window & {
  __intersectionObserverControl__?: {
    observed: number
    disconnected: number
    deliverQueuedIntersection: () => void
  }
  __lazyMermaidControl__?: {
    runs: string[]
    pending: number
    releaseNext: () => void
  }
}

type BrowserPage = Awaited<ReturnType<typeof createPage>>

async function waitForRuns(page: BrowserPage, expected: number) {
  await page.waitForFunction((count: number) => {
    return (window as LazyConflictWindow).__lazyMermaidControl__?.runs.length === count
  }, expected, { timeout: 5000 })
}

async function releaseNext(page: BrowserPage) {
  await page.evaluate(() => {
    (window as LazyConflictWindow).__lazyMermaidControl__?.releaseNext()
  })
}

async function createControlledLazyPage() {
  const page = await createPage()
  await page.addInitScript(() => {
    let queuedCallback: IntersectionObserverCallback | undefined
    const control = {
      observed: 0,
      disconnected: 0,
      deliverQueuedIntersection: () => {
        queuedCallback?.([
          { isIntersecting: true } as IntersectionObserverEntry,
        ], {} as IntersectionObserver)
      },
    }

    class ControlledIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        queuedCallback = callback
      }

      observe() {
        control.observed++
      }

      disconnect() {
        control.disconnected++
      }

      unobserve() {}

      takeRecords() {
        return []
      }
    }

    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: ControlledIntersectionObserver,
    })
    ;(window as LazyConflictWindow).__intersectionObserverControl__ = control
  })

  await page.goto(url('/'))
  await page.waitForFunction(() => {
    return (window as LazyConflictWindow).__intersectionObserverControl__?.observed === 1
  })
  return page
}

describe('lazy conflict recovery', async () => {
  await setup({
    rootDir,
    browser: true,
  })

  it('ignores an already queued lazy callback during the first recovery render', { timeout: 20000 }, async () => {
    const page = await createControlledLazyPage()
    expect(await page.evaluate(() => (window as LazyConflictWindow).__lazyMermaidControl__?.runs.length ?? 0)).toBe(0)

    await page.locator('#enter-conflict').click()
    await page.waitForFunction(() => document.querySelector('#component-error')?.textContent === '1')
    await page.locator('#recover-conflict').click()
    await waitForRuns(page, 1)
    await page.evaluate(() => {
      (window as LazyConflictWindow).__intersectionObserverControl__?.deliverQueuedIntersection()
    })
    await releaseNext(page)
    await page.waitForFunction(() => {
      return document.querySelector('svg[data-source*="RECOVERED_LATEST"]')
        || (window as LazyConflictWindow).__lazyMermaidControl__?.runs.length === 2
    })
    expect(await page.evaluate(() => (window as LazyConflictWindow).__lazyMermaidControl__?.runs.length)).toBe(1)
    await page.locator('svg[data-source*="RECOVERED_LATEST"]').waitFor({ state: 'visible', timeout: 5000 })

    expect(await page.evaluate(() => {
      const control = (window as LazyConflictWindow).__intersectionObserverControl__
      return { observed: control?.observed, disconnected: control?.disconnected }
    })).toEqual({ observed: 1, disconnected: 1 })
  })

  it('accepts a later legal update after the first recovery render fails', { timeout: 20000 }, async () => {
    const page = await createControlledLazyPage()
    await page.locator('#enter-conflict').click()
    await page.waitForFunction(() => document.querySelector('#component-error')?.textContent === '1')
    await page.locator('#recover-conflict-with-failure').click()
    await waitForRuns(page, 1)
    await releaseNext(page)
    await page.waitForFunction(() => (window as LazyConflictWindow).__lazyMermaidControl__?.pending === 0)

    await page.locator('#retry-recovery').click()
    await waitForRuns(page, 2)
    await releaseNext(page)
    await page.locator('svg[data-source*="RECOVERED_AFTER_FAILURE"]').waitFor({ state: 'visible', timeout: 5000 })

    expect(await page.evaluate(() => {
      return (window as LazyConflictWindow).__intersectionObserverControl__?.disconnected
    })).toBe(1)
  })
})
