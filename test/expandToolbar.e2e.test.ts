import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { setup, createPage, url } from '@nuxt/test-utils/e2e'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/expand-toolbar')

const parsePercent = (value: string | null) => {
  if (!value) return Number.NaN
  return Number.parseInt(value.replace('%', '').trim(), 10)
}

describe('expand/fullscreen toolbars', async () => {
  await setup({
    rootDir,
    browser: true,
  })

  it('opens expand overlay, zooms, shows hint, and closes', { timeout: 20000 }, async () => {
    const page = await createPage()
    await page.goto(url('/'))

    await page.waitForSelector('#mock-svg', { state: 'visible', timeout: 5000 })

    await page.getByLabel('Expand diagram').click()
    await page.waitForSelector('.ncm-expand-modal', { state: 'visible', timeout: 5000 })

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
  })

  it('toggles fullscreen toolbar, zooms, and shows hint', { timeout: 20000 }, async () => {
    const page = await createPage()

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

    await page.goto(url('/'))
    await page.waitForSelector('#mock-svg', { state: 'visible', timeout: 5000 })

    await page.getByLabel('Enter fullscreen').click()
    await page.waitForSelector('.ncm-zoom-toolbar--fullscreen', { state: 'visible', timeout: 5000 })
    expect(await page.locator('.ncm-fullscreen-zoom-hint').count()).toBe(0)

    const fullscreenZoomInfo = page.locator('.ncm-zoom-toolbar--fullscreen .ncm-zoom-info')
    const initialFullscreenPercent = parsePercent(await fullscreenZoomInfo.textContent())
    expect(Number.isFinite(initialFullscreenPercent)).toBe(true)

    await page.locator('.ncm-zoom-toolbar--fullscreen button[aria-label="Zoom In"]').click()
    await page.waitForTimeout(100)
    const afterFullscreenPercent = parsePercent(await fullscreenZoomInfo.textContent())
    expect(afterFullscreenPercent).toBeGreaterThan(initialFullscreenPercent)

    await page.evaluate(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }))
    })
    await page.waitForSelector('.ncm-fullscreen-zoom-hint', { state: 'attached', timeout: 2000 })
    const hintText = await page.locator('.ncm-fullscreen-zoom-hint').textContent()
    expect(hintText).toContain('Scroll to zoom')

    await page.getByLabel('Exit fullscreen').click()
    await page.waitForSelector('.ncm-zoom-toolbar--fullscreen', { state: 'detached', timeout: 5000 })
  })
})
