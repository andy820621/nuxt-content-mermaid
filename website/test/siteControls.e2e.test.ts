import { fileURLToPath } from 'node:url'
import { createPage, setup, url } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const websiteRoot = fileURLToPath(new URL('..', import.meta.url))
const colorModeStorageKey = 'nuxt-content-mermaid-color-mode'

type ViewTransitionLog = {
  animations: Array<{ keyframes: Array<{ clipPath?: string }>, timing: { duration?: number, pseudoElement?: string } }>
  calls: number
  click?: { x: number, y: number }
}

type PendingTransitionLog = {
  calls: number
  release: () => void
}

async function loadWithSystemColorMode(
  page: Awaited<ReturnType<typeof createPage>>,
  colorScheme: 'dark' | 'light',
  reducedMotion?: 'reduce' | 'no-preference',
) {
  await page.emulateMedia({ colorScheme, reducedMotion })
  await page.goto(url('/'))
  await page.evaluate((storageKey) => localStorage.removeItem(storageKey), colorModeStorageKey)
  await page.reload()
}

describe('documentation website site controls', async () => {
  await setup({
    rootDir: websiteRoot,
    browser: true,
  })

  it('uses the system dark preference for the initial color mode', async () => {
    const page = await createPage()
    await loadWithSystemColorMode(page, 'dark')

    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark')
  })

  it('persists a manually selected dark mode across a reload', async () => {
    const page = await createPage()
    await loadWithSystemColorMode(page, 'light')

    await page.getByRole('button', { name: 'Switch to dark mode' }).click()

    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark')
    expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), colorModeStorageKey)).toBe('dark')

    await page.reload()

    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark')
  })

  it('redraws the Mermaid SVG when the color mode changes', { timeout: 10000 }, async () => {
    const page = await createPage()
    await loadWithSystemColorMode(page, 'light')

    const svg = page.locator('.mermaid-block .mermaid > svg')
    await page.waitForFunction(() => document.querySelector('.mermaid-block .mermaid > svg') !== null)
    const initialSvg = await svg.evaluate(element => element.outerHTML)

    await page.getByRole('button', { name: 'Switch to dark mode' }).click()

    const redrawn = await page.evaluate(async (previousSvg) => {
      const deadline = Date.now() + 2000
      while (Date.now() < deadline) {
        if (document.querySelector('.mermaid-block .mermaid > svg')?.outerHTML !== previousSvg)
          return true
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      return false
    }, initialSvg)

    expect(redrawn).toBe(true)
  })

  it('reveals the selected mode from the click origin with a 400ms view transition', async () => {
    const page = await createPage()
    await page.addInitScript(() => {
      const log: ViewTransitionLog = { animations: [], calls: 0 }
      ;(window as Window & { __websiteThemeTransitionLog?: ViewTransitionLog }).__websiteThemeTransitionLog = log
      document.addEventListener('click', (event) => {
        log.click = { x: event.clientX, y: event.clientY }
      })
      const animate = Element.prototype.animate
      Element.prototype.animate = function (keyframes, timing) {
        if (this === document.documentElement) {
          log.animations.push({
            keyframes: keyframes as Array<{ clipPath?: string }>,
            timing: timing as { duration?: number, pseudoElement?: string },
          })
        }
        return animate.call(this, keyframes, timing)
      }
      ;(document as Document & {
        startViewTransition?: (callback: () => void) => { finished: Promise<void>, ready: Promise<void> }
      }).startViewTransition = (callback) => {
        log.calls += 1
        callback()
        return { ready: Promise.resolve(), finished: Promise.resolve() }
      }
    })
    await loadWithSystemColorMode(page, 'light')

    await page.getByRole('button', { name: 'Switch to dark mode' }).click({ position: { x: 8, y: 8 } })

    const log = await page.evaluate(() => {
      return (window as Window & { __websiteThemeTransitionLog: ViewTransitionLog }).__websiteThemeTransitionLog
    })
    expect(log.calls).toBe(1)
    expect(log.animations).toHaveLength(1)
    expect(log.animations[0]?.timing).toMatchObject({
      duration: 400,
      pseudoElement: '::view-transition-new(root)',
    })
    expect(log.animations[0]?.keyframes[0]?.clipPath).toBe(`circle(0px at ${log.click?.x}px ${log.click?.y}px)`)
  })

  it('changes mode without a view transition when reduced motion is preferred', async () => {
    const page = await createPage()
    await page.addInitScript(() => {
      const log: ViewTransitionLog = { animations: [], calls: 0 }
      ;(window as Window & { __websiteThemeTransitionLog?: ViewTransitionLog }).__websiteThemeTransitionLog = log
      ;(document as Document & {
        startViewTransition?: (callback: () => void) => { finished: Promise<void>, ready: Promise<void> }
      }).startViewTransition = (callback) => {
        log.calls += 1
        callback()
        return { ready: Promise.resolve(), finished: Promise.resolve() }
      }
    })
    await loadWithSystemColorMode(page, 'light', 'reduce')

    await page.getByRole('button', { name: 'Switch to dark mode' }).click()

    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark')
    expect(await page.evaluate(() => {
      return (window as Window & { __websiteThemeTransitionLog: ViewTransitionLog }).__websiteThemeTransitionLog.calls
    })).toBe(0)
  })

  it('changes mode when the View Transition API is unavailable', async () => {
    const page = await createPage()
    await page.addInitScript(() => {
      Object.defineProperty(document, 'startViewTransition', {
        configurable: true,
        value: undefined,
      })
    })
    await loadWithSystemColorMode(page, 'light')

    await page.getByRole('button', { name: 'Switch to dark mode' }).click()

    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark')
  })

  it('falls back to a direct mode change when the view transition rejects', async () => {
    const page = await createPage()
    await page.addInitScript(() => {
      ;(document as Document & {
        startViewTransition?: (_callback: () => void) => { finished: Promise<void>, ready: Promise<void> }
      }).startViewTransition = () => ({
        finished: Promise.resolve(),
        ready: Promise.reject(new Error('view transition rejected')),
      })
    })
    await loadWithSystemColorMode(page, 'light')

    await page.getByRole('button', { name: 'Switch to dark mode' }).click()

    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark')
  })

  it('ignores repeated toggles until the active view transition finishes', async () => {
    const page = await createPage()
    await page.addInitScript(() => {
      let release = () => {}
      const log: PendingTransitionLog = {
        calls: 0,
        release: () => release(),
      }
      ;(window as Window & { __websiteThemePendingTransition?: PendingTransitionLog }).__websiteThemePendingTransition = log
      ;(document as Document & {
        startViewTransition?: (callback: () => void) => { finished: Promise<void>, ready: Promise<void> }
      }).startViewTransition = (callback) => {
        log.calls += 1
        callback()
        return {
          ready: Promise.resolve(),
          finished: new Promise<void>((resolve) => {
            release = resolve
          }),
        }
      }
    })
    await loadWithSystemColorMode(page, 'light')

    const toggle = page.locator('.site-actions > button').first()
    await toggle.click()
    await toggle.click()

    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark')
    expect(await page.evaluate(() => {
      return (window as Window & { __websiteThemePendingTransition: PendingTransitionLog }).__websiteThemePendingTransition.calls
    })).toBe(1)

    await page.evaluate(() => {
      ;(window as Window & { __websiteThemePendingTransition: PendingTransitionLog }).__websiteThemePendingTransition.release()
    })
  })
})
