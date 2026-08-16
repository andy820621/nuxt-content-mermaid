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
  await page.goto(url('/'), { waitUntil: 'hydration' })
  await page.waitForFunction(() => document.querySelector('button[aria-pressed]') !== null)
}

describe('documentation website site controls', async () => {
  await setup({
    rootDir: websiteRoot,
    browser: true,
    host: process.env.WEBSITE_E2E_HOST,
  })

  it('uses the system dark preference for the initial color mode', async () => {
    const page = await createPage()
    await loadWithSystemColorMode(page, 'dark')

    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark')
  })

  it('shows the active dark theme and its next action', async () => {
    const page = await createPage()
    await loadWithSystemColorMode(page, 'dark')

    const toggle = page.getByRole('button', { name: 'Switch to light mode' })
    expect(await toggle.getAttribute('aria-pressed')).toBe('true')
    expect(await toggle.locator('[data-theme-icon="moon"]').count()).toBe(1)
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

  it('stacks the root view-transition snapshots for each theme direction', async () => {
    const page = await createPage()
    await loadWithSystemColorMode(page, 'light')

    const lightStack = await page.evaluate(() => ({
      old: Number(getComputedStyle(document.documentElement, '::view-transition-old(root)').zIndex),
      new: Number(getComputedStyle(document.documentElement, '::view-transition-new(root)').zIndex),
    }))
    expect(lightStack.new).toBeGreaterThan(lightStack.old)

    await page.getByRole('button', { name: 'Switch to dark mode' }).click()
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')

    const darkStack = await page.evaluate(() => ({
      old: Number(getComputedStyle(document.documentElement, '::view-transition-old(root)').zIndex),
      new: Number(getComputedStyle(document.documentElement, '::view-transition-new(root)').zIndex),
    }))
    expect(darkStack.old).toBeGreaterThan(darkStack.new)
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

  it('crossfades to the animated destination icon while the toggle is busy', async () => {
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

    const toggle = page.getByRole('button', { name: /Switch to (dark|light) mode/ })
    await toggle.click()

    expect(await toggle.isDisabled()).toBe(true)
    expect(await toggle.getAttribute('aria-busy')).toBe('true')
    expect(await page.evaluate(() => {
      return (window as Window & { __websiteThemePendingTransition: PendingTransitionLog }).__websiteThemePendingTransition.calls
    })).toBe(1)

    const animatedMoon = toggle.locator('[data-theme-icon="moon-animated"]')
    expect(await animatedMoon.locator('[class~="i-line-md:moon-twotone"]').count()).toBe(1)
    await page.waitForFunction(() => {
      const icon = document.querySelector('[data-theme-icon="moon-animated"]')
      return icon && getComputedStyle(icon).opacity === '1'
    })
    expect(await toggle.locator('[data-theme-icon="moon"]').evaluate(element => getComputedStyle(element).opacity)).toBe('0')
    expect(await toggle.evaluate((element) => {
      const style = getComputedStyle(element)
      return { cursor: style.cursor, opacity: Number(style.opacity) }
    })).toMatchObject({ cursor: 'wait', opacity: 0.65 })

    await page.evaluate(() => {
      ;(window as Window & { __websiteThemePendingTransition: PendingTransitionLog }).__websiteThemePendingTransition.release()
    })
    await page.waitForFunction(() => document.querySelector('[aria-busy="true"]') === null)
    expect(await toggle.isDisabled()).toBe(false)

    await toggle.click()

    const animatedSun = toggle.locator('[data-theme-icon="sun-animated"]')
    expect(await animatedSun.locator('[class~="i-line-md:sunny-outline-twotone-loop"]').count()).toBe(1)
    await page.waitForFunction(() => {
      const icon = document.querySelector('[data-theme-icon="sun-animated"]')
      return icon && getComputedStyle(icon).opacity === '1'
    })
    expect(await toggle.locator('[data-theme-icon="sun"]').evaluate(element => getComputedStyle(element).opacity)).toBe('0')

    await page.evaluate(() => {
      ;(window as Window & { __websiteThemePendingTransition: PendingTransitionLog }).__websiteThemePendingTransition.release()
    })
    await page.waitForFunction(() => document.querySelector('[aria-busy="true"]') === null)
  })

  it('reveals the next theme action in a tooltip on hover', async () => {
    const page = await createPage()
    await page.goto(url('/'), { waitUntil: 'hydration' })

    const toggle = page.getByRole('button', { name: /Switch to (dark|light) mode/ })
    const bounds = await toggle.boundingBox()
    if (!bounds)
      throw new Error('Theme toggle must be visible before hovering')

    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    )

    const tooltip = page.getByRole('tooltip')
    await tooltip.waitFor({ state: 'visible', timeout: 3000 })
    expect(await tooltip.count()).toBe(1)
    expect(await tooltip.isVisible()).toBe(true)
    expect(await tooltip.textContent()).toBe(await toggle.getAttribute('aria-label'))
  })

  it('reveals the next theme action in a tooltip on keyboard focus', async () => {
    const page = await createPage()
    await page.goto(url('/'), { waitUntil: 'hydration' })

    const toggle = page.getByRole('button', { name: /Switch to (dark|light) mode/ })
    let focused = false
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press('Tab')
      focused = await toggle.evaluate(element => element === document.activeElement)
      if (focused)
        break
    }
    expect(focused).toBe(true)

    const tooltip = page.getByRole('tooltip')
    await tooltip.waitFor({ state: 'visible', timeout: 3000 })
    expect(await tooltip.count()).toBe(1)
    expect(await tooltip.isVisible()).toBe(true)
    expect(await tooltip.textContent()).toBe(await toggle.getAttribute('aria-label'))
  })
})
