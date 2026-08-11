import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { setup, createPage, url } from '@nuxt/test-utils/e2e'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/expand-toolbar')

const parsePercent = (value: string | null) => {
  if (!value) return Number.NaN
  return Number.parseInt(value.replace('%', '').trim(), 10)
}

type BrowserPage = Awaited<ReturnType<typeof createPage>>

const restoredPageStyles = {
  bodyOverflow: '',
  bodyWidth: '',
  bodyUserSelect: '',
  htmlOverflow: '',
  htmlWidth: '',
  htmlUserSelect: '',
}

async function readPageStyles(page: BrowserPage) {
  return page.evaluate(() => ({
    bodyOverflow: document.body.style.overflow,
    bodyWidth: document.body.style.width,
    bodyUserSelect: document.body.style.userSelect,
    htmlOverflow: document.documentElement.style.overflow,
    htmlWidth: document.documentElement.style.width,
    htmlUserSelect: document.documentElement.style.userSelect,
  }))
}

async function readOutsideRouting(page: BrowserPage) {
  return page.evaluate(() => {
    const wheel = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
    const key = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    window.dispatchEvent(wheel)
    document.dispatchEvent(key)
    return { wheel: wheel.defaultPrevented, key: key.defaultPrevented }
  })
}

async function installFullscreenStub(page: BrowserPage) {
  await page.addInitScript(() => {
    const defineWritable = (target: object, key: string, value: unknown) => {
      try {
        Object.defineProperty(target, key, { value, writable: true, configurable: true })
      }
      catch {
        // ignore
      }
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

describe('expand/fullscreen toolbars', async () => {
  await setup({
    rootDir,
    browser: true,
  })

  it('proves the complete expand lifecycle through toolbar and diagram entry', { timeout: 20000 }, async () => {
    const page = await createPage()
    await page.goto(url('/'))

    await page.waitForSelector('#mock-svg', { state: 'visible', timeout: 5000 })

    await page.locator('#diagram-root').getByLabel('Expand diagram').click()
    await page.waitForSelector('.ncm-expand-modal', { state: 'visible', timeout: 5000 })

    expect(await page.locator('body > .ncm-expand-modal').count()).toBe(1)
    expect(await page.locator('.mermaid-wrapper.ncm-expand-hidden #mock-svg').count()).toBe(1)
    expect(await page.locator('.ncm-expand-modal > .ncm-expand-overlay.ncm-expand-overlay-visible').count()).toBe(1)
    expect(await page.locator('.ncm-expand-clip > .ncm-expand-target > svg[id^="mock-svg-ncm-"]').count()).toBe(1)
    expect(await page.getByLabel('Minimize diagram').getAttribute('type')).toBe('button')

    const overlayZoomInfo = page.locator('.ncm-zoom-toolbar--overlay .ncm-zoom-info')
    const initialOverlayPercent = parsePercent(await overlayZoomInfo.textContent())
    expect(Number.isFinite(initialOverlayPercent)).toBe(true)

    await page.locator('.ncm-zoom-toolbar--overlay button[aria-label="Zoom In"]').click()
    await page.waitForTimeout(100)
    const afterOverlayPercent = parsePercent(await overlayZoomInfo.textContent())
    expect(afterOverlayPercent).toBeGreaterThan(initialOverlayPercent)

    await page.evaluate(() => {
      const target = document.querySelector('.ncm-expand-target')
      if (!target) return
      target.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }))
    })
    await page.waitForSelector('.ncm-zoom-hint', { state: 'visible', timeout: 2000 })

    await page.getByLabel('Minimize diagram').click()
    await page.waitForSelector('.ncm-expand-modal', { state: 'detached', timeout: 5000 })
    expect(await page.locator('.mermaid-wrapper.ncm-expand-hidden').count()).toBe(0)

    expect(await readOutsideRouting(page)).toEqual({ wheel: false, key: false })

    await page.locator('#mock-svg').click()
    await page.waitForSelector('body > .ncm-expand-modal', { state: 'visible', timeout: 5000 })

    const spaceLocked = await page.evaluate(() => {
      const event = new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true })
      document.dispatchEvent(event)
      return {
        prevented: event.defaultPrevented,
        body: document.body.style.userSelect,
        html: document.documentElement.style.userSelect,
      }
    })
    expect(spaceLocked).toEqual({ prevented: true, body: 'none', html: 'none' })

    await page.getByLabel('Minimize diagram').click()
    await page.waitForSelector('.ncm-expand-modal', { state: 'detached', timeout: 5000 })

    expect(await readOutsideRouting(page)).toEqual({ wheel: false, key: false })
    expect(await readPageStyles(page)).toEqual(restoredPageStyles)

    const openThenClose = async (close: () => Promise<unknown>) => {
      await page.locator('#mock-svg').click()
      await page.waitForSelector('.ncm-expand-modal', { state: 'visible', timeout: 5000 })
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
      await close()
      await page.waitForSelector('.ncm-expand-modal', { state: 'detached', timeout: 5000 })
    }

    await openThenClose(() => page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    }))
    await openThenClose(() => page.locator('.ncm-expand-overlay').dispatchEvent('click'))
    await openThenClose(() => page.evaluate(() => {
      document.querySelector('.ncm-expand-overlay')
        ?.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }))
    }))
    await openThenClose(() => page.evaluate(() => {
      const createTouchEvent = (type: string, screenY: number) => {
        const event = new Event(type, { bubbles: true, cancelable: true })
        const touch = { screenY }
        Object.defineProperties(event, {
          touches: { value: [touch] },
          changedTouches: { value: [touch] },
        })
        return event
      }
      window.dispatchEvent(createTouchEvent('touchstart', 10))
      window.dispatchEvent(createTouchEvent('touchmove', 30))
    }))

    await page.locator('#mock-svg').click()
    await page.waitForSelector('.ncm-expand-modal', { state: 'visible', timeout: 5000 })
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }))
      document.querySelector<HTMLButtonElement>('#unmount-diagram')?.click()
    })
    await page.waitForSelector('#diagram-root', { state: 'detached', timeout: 5000 })
    await page.waitForSelector('.ncm-expand-modal', { state: 'detached', timeout: 5000 })

    expect(await readPageStyles(page)).toEqual(restoredPageStyles)
    expect(await readOutsideRouting(page)).toEqual({ wheel: false, key: false })
  })

  it('closes a horizontally scrolled diagram into the visible source viewport', { timeout: 20000 }, async () => {
    const page = await createPage()
    await page.goto(url('/'))
    await page.waitForSelector('#mock-svg', { state: 'visible', timeout: 5000 })

    const source = await page.evaluate(() => {
      const wrapper = document.querySelector<HTMLElement>('#diagram-root .mermaid-wrapper')!
      const svg = document.querySelector<SVGSVGElement>('#mock-svg')!
      wrapper.scrollLeft = wrapper.scrollWidth - wrapper.clientWidth
      const wrapperRect = wrapper.getBoundingClientRect()
      return {
        scrollLeft: wrapper.scrollLeft,
        viewportLeft: wrapperRect.left + wrapper.clientLeft,
        svgLeft: svg.getBoundingClientRect().left,
      }
    })
    expect(source.scrollLeft).toBeGreaterThan(0)
    expect(source.svgLeft).toBeLessThan(source.viewportLeft)

    await page.locator('#diagram-root').getByLabel('Expand diagram').click()
    await page.waitForSelector('.ncm-expand-modal', { state: 'visible', timeout: 5000 })
    const lockedViewportLeft = await page.locator('#diagram-root .mermaid-wrapper').evaluate((wrapper) => {
      const rect = wrapper.getBoundingClientRect()
      return rect.left + wrapper.clientLeft
    })

    const closingGeometry = await page.evaluate(async () => {
      document.querySelector<HTMLButtonElement>('[aria-label="Minimize diagram"]')?.click()
      await Promise.resolve()
      const samples: number[] = []
      let destinationLeft = Number.NaN
      for (let index = 0; index < 8; index++) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
        const clip = document.querySelector<HTMLElement>('.ncm-expand-clip')
        if (clip) {
          if (!Number.isFinite(destinationLeft)) destinationLeft = Number.parseFloat(clip.style.left)
          samples.push(clip.getBoundingClientRect().left)
        }
      }
      return { destinationLeft, samples }
    })
    expect(closingGeometry.samples.length).toBeGreaterThan(0)
    expect(Math.abs(closingGeometry.destinationLeft - source.viewportLeft)).toBeLessThanOrEqual(1)
    expect(Math.min(...closingGeometry.samples)).toBeGreaterThanOrEqual(
      Math.min(32, lockedViewportLeft, closingGeometry.destinationLeft) - 2,
    )

    await page.waitForSelector('.ncm-expand-modal', { state: 'detached', timeout: 5000 })
    expect(await page.locator('#diagram-root .mermaid-wrapper').evaluate(wrapper => wrapper.scrollLeft)).toBe(source.scrollLeft)
  })

  it('proves the complete fullscreen lifecycle and cleanup through the Package User path', { timeout: 20000 }, async () => {
    const page = await createPage()
    await installFullscreenStub(page)
    await page.goto(url('/'))
    await page.waitForSelector('#mock-svg', { state: 'visible', timeout: 5000 })
    expect(await page.locator('#mock-svg').getAttribute('preserveAspectRatio')).toBe('xMinYMin meet')

    await page.locator('#diagram-root').getByLabel('Enter fullscreen').click({ timeout: 5000 })
    await page.waitForSelector('.ncm-zoom-toolbar--fullscreen', { state: 'visible', timeout: 5000 })
    expect(await page.locator('#mock-svg').getAttribute('preserveAspectRatio')).toBe('xMidYMid meet')
    expect(await page.locator('.ncm-fullscreen-zoom-hint').count()).toBe(0)
    expect(await page.locator('#diagram-root .mermaid-block > .ncm-zoom-toolbar--fullscreen').count()).toBe(1)
    expect(await page.locator('#diagram-root .mermaid-wrapper.ncm-fullscreen-zoom > .mermaid').count()).toBe(1)
    expect(await page.evaluate(() => document.fullscreenElement?.classList.contains('mermaid-block'))).toBe(true)

    const fullscreenZoomInfo = page.locator('.ncm-zoom-toolbar--fullscreen .ncm-zoom-info')
    const initialFullscreenPercent = parsePercent(await fullscreenZoomInfo.textContent())
    expect(Number.isFinite(initialFullscreenPercent)).toBe(true)

    await page.waitForTimeout(100)
    await page.locator('.ncm-zoom-toolbar--fullscreen button[aria-label="Zoom In"]').dispatchEvent('click')
    await page.waitForTimeout(100)
    const afterFullscreenPercent = parsePercent(await fullscreenZoomInfo.textContent())
    expect(afterFullscreenPercent).toBeGreaterThan(initialFullscreenPercent)

    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'))
      window.visualViewport?.dispatchEvent(new Event('resize'))
      return new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    })
    expect(parsePercent(await fullscreenZoomInfo.textContent())).toBe(afterFullscreenPercent)

    const activeRouting = await page.evaluate(() => {
      const wheel = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
      const key = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
      window.dispatchEvent(wheel)
      document.dispatchEvent(key)
      return { wheel: wheel.defaultPrevented, key: key.defaultPrevented }
    })
    expect(activeRouting).toEqual({ wheel: false, key: true })
    await page.waitForSelector('.ncm-fullscreen-zoom-hint', { state: 'attached', timeout: 2000 })
    const hintText = await page.locator('.ncm-fullscreen-zoom-hint').textContent()
    expect(hintText).toContain('Scroll to zoom')

    const spaceLocked = await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }))
      document.querySelector('.mermaid-wrapper')
        ?.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true, cancelable: true }))
      return {
        body: document.body.style.userSelect,
        html: document.documentElement.style.userSelect,
      }
    })
    expect(spaceLocked).toEqual({ body: 'none', html: 'none' })

    await page.locator('#diagram-root').getByLabel('Exit fullscreen').click({ timeout: 5000 })
    await page.waitForSelector('.ncm-zoom-toolbar--fullscreen', { state: 'detached', timeout: 5000 })
    expect(await page.locator('#mock-svg').getAttribute('preserveAspectRatio')).toBe('xMinYMin meet')
    expect(await readOutsideRouting(page)).toEqual({ wheel: false, key: false })
    expect(await readPageStyles(page)).toEqual(restoredPageStyles)

    await page.locator('#diagram-root').getByLabel('Enter fullscreen').click({ timeout: 5000 })
    await page.waitForSelector('.ncm-zoom-toolbar--fullscreen', { state: 'visible', timeout: 5000 })
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }))
      document.querySelector<HTMLButtonElement>('#unmount-diagram')?.click()
    })
    await page.waitForSelector('#diagram-root', { state: 'detached', timeout: 5000 })
    await page.waitForSelector('.ncm-zoom-toolbar--fullscreen', { state: 'detached', timeout: 5000 })
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull()
    expect(await readOutsideRouting(page)).toEqual({ wheel: false, key: false })
    expect(await readPageStyles(page)).toEqual(restoredPageStyles)
  })

  it('ends fullscreen on render replacement and keeps diagrams isolated', { timeout: 20000 }, async () => {
    const page = await createPage()
    await installFullscreenStub(page)
    await page.goto(url('/'))
    await page.waitForSelector('#mock-svg-secondary', { state: 'visible', timeout: 5000 })

    await page.locator('#diagram-root').getByLabel('Expand diagram').click()
    await page.waitForSelector('.ncm-expand-modal', { state: 'visible', timeout: 5000 })
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('#diagram-root [aria-label="Enter fullscreen"]')?.click()
    })
    await page.waitForSelector('#diagram-root .ncm-zoom-toolbar--fullscreen', { state: 'visible', timeout: 5000 })
    await page.waitForSelector('.ncm-expand-modal', { state: 'detached', timeout: 5000 })
    await page.locator('#mock-svg').click()
    expect(await page.locator('.ncm-expand-modal').count()).toBe(0)
    expect(await page.locator('#diagram-root [aria-label="Expand diagram"]').count()).toBe(0)
    await page.locator('#diagram-root').getByLabel('Exit fullscreen').click({ timeout: 5000 })
    await page.waitForSelector('.ncm-zoom-toolbar--fullscreen', { state: 'detached', timeout: 5000 })

    await page.locator('#diagram-root').getByLabel('Enter fullscreen').click({ timeout: 5000 })
    await page.waitForSelector('#diagram-root .ncm-zoom-toolbar--fullscreen', { state: 'visible', timeout: 5000 })
    expect(await page.locator('#secondary-root .ncm-zoom-toolbar--fullscreen').count()).toBe(0)

    await page.evaluate(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }))
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }))
      document.querySelector<HTMLButtonElement>('#update-diagram')?.click()
    })

    await page.waitForSelector('#diagram-root .ncm-zoom-toolbar--fullscreen', { state: 'detached', timeout: 5000 })
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull()
    expect(await page.locator('#secondary-root #mock-svg-secondary').count()).toBe(1)
    expect(await readOutsideRouting(page)).toEqual({ wheel: false, key: false })
    expect(await readPageStyles(page)).toEqual(restoredPageStyles)

    await page.locator('#secondary-root').getByLabel('Enter fullscreen').click({ timeout: 5000 })
    await page.waitForSelector('#secondary-root .ncm-zoom-toolbar--fullscreen', { state: 'visible', timeout: 5000 })
    expect(await page.locator('#diagram-root .ncm-zoom-toolbar--fullscreen').count()).toBe(0)
    expect(await page.evaluate(() => document.fullscreenElement?.closest('#secondary-root') !== null)).toBe(true)

    await page.locator('#secondary-root').getByLabel('Exit fullscreen').click({ timeout: 5000 })
    await page.waitForSelector('.ncm-zoom-toolbar--fullscreen', { state: 'detached', timeout: 5000 })
    expect(await readOutsideRouting(page)).toEqual({ wheel: false, key: false })
  })
})
