import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createPage, setup, url } from '@nuxt/test-utils/e2e'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/lazy-conflict')

type LazyConflictWindow = Window & {
  __intersectionObserverControl__?: {
    observed: number
    disconnected: number
  }
  __lazyMermaidControl__?: {
    runs: string[]
  }
}

describe('lazy conflict recovery', async () => {
  await setup({
    rootDir,
    browser: true,
  })

  it('ends lazy observation before the first recovery render', { timeout: 20000 }, async () => {
    const page = await createPage()
    await page.addInitScript(() => {
      const control = { observed: 0, disconnected: 0 }

      class ControlledIntersectionObserver {
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
    expect(await page.evaluate(() => (window as LazyConflictWindow).__lazyMermaidControl__?.runs.length ?? 0)).toBe(0)

    await page.locator('#enter-conflict').click()
    await page.waitForFunction(() => document.querySelector('#component-error')?.textContent === '1')
    await page.locator('#recover-conflict').click()
    await page.waitForFunction(() => (window as LazyConflictWindow).__lazyMermaidControl__?.runs.length === 1)
    await page.locator('svg[data-source*="RECOVERED_LATEST"]').waitFor({ state: 'visible', timeout: 5000 })

    expect(await page.evaluate(() => (window as LazyConflictWindow).__intersectionObserverControl__)).toEqual({
      observed: 1,
      disconnected: 1,
    })
  })
})
