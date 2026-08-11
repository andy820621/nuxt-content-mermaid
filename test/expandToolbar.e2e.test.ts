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
type RectGeometry = { top: number, left: number, width: number, height: number }

const rectDistance = (from: RectGeometry, to: RectGeometry) => Math.hypot(
  from.top - to.top,
  from.left - to.left,
  from.width - to.width,
  from.height - to.height,
)

async function readRasterBounds(page: BrowserPage, color: [number, number, number]) {
  const screenshot = await page.screenshot({ animations: 'allow' })
  return page.evaluate(async ({ encodedPng, color }) => {
    const image = new Image()
    image.src = `data:image/png;base64,${encodedPng}`
    await image.decode()

    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let left = canvas.width
    let right = -1
    let top = canvas.height
    let bottom = -1

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const offset = (y * canvas.width + x) * 4
        if (
          Math.abs(pixels[offset]! - color[0]) > 2
          || Math.abs(pixels[offset + 1]! - color[1]) > 2
          || Math.abs(pixels[offset + 2]! - color[2]) > 2
          || pixels[offset + 3]! < 250
        ) continue
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
    }

    if (right < left || bottom < top) return null
    const deviceScale = canvas.width / window.innerWidth
    return {
      left: left / deviceScale,
      right: (right + 1) / deviceScale,
      top: top / deviceScale,
      bottom: (bottom + 1) / deviceScale,
      width: (right - left + 1) / deviceScale,
      height: (bottom - top + 1) / deviceScale,
      centerX: (left + right + 1) / 2 / deviceScale,
    }
  }, { encodedPng: screenshot.toString('base64'), color })
}

async function sampleExpandRasterCenters(
  page: BrowserPage,
  times: number[],
  color: [number, number, number],
) {
  await page.waitForFunction(() => document.getAnimations().some((animation) => {
    const target = (animation.effect as KeyframeEffect | null)?.target
    return animation.playState !== 'finished'
      && target instanceof HTMLElement
      && target.classList.contains('ncm-expand-target')
  }))

  const centers: number[] = []
  for (const time of times) {
    await page.evaluate(async (time) => {
      const animations = document.getAnimations().filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target
        return target instanceof HTMLElement
          && (target.classList.contains('ncm-expand-clip') || target.classList.contains('ncm-expand-target'))
      })
      for (const animation of animations) {
        animation.pause()
        animation.currentTime = time
      }
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    }, time)
    const raster = await readRasterBounds(page, color)
    expect(raster).not.toBeNull()
    centers.push(raster!.centerX)
  }
  return centers
}

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
    await page.waitForSelector('.ncm-expand-modal > .ncm-expand-overlay.ncm-expand-overlay-visible', {
      state: 'visible',
      timeout: 5000,
    })

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

  it('expands a scrolled source aperture progressively in the raster output', { timeout: 20000 }, async () => {
    const page = await createPage()
    await page.setViewportSize({ width: 1000, height: 800 })
    await page.goto(url('/'))
    await page.waitForSelector('#mock-svg', { state: 'visible', timeout: 5000 })
    await page.addStyleTag({
      content: `
        #diagram-root {
          width: 300px;
          margin-left: 300px;
        }
        .ncm-expand-overlay {
          background: white !important;
          backdrop-filter: none !important;
          opacity: 1 !important;
        }
        .ncm-expand-clip,
        .ncm-expand-target {
          transition-duration: 1000ms !important;
          transition-timing-function: linear !important;
        }
        .ncm-expand-target {
          background: rgb(13, 197, 97) !important;
        }
      `,
    })

    const source = await page.evaluate(() => {
      Object.defineProperty(document.documentElement, 'clientWidth', {
        configurable: true,
        get: () => document.documentElement.style.overflow === 'hidden'
          ? window.innerWidth
          : window.innerWidth - 20,
      })
      const root = document.querySelector<HTMLElement>('#diagram-root')!
      const wrapper = root.querySelector<HTMLElement>('.mermaid-wrapper')!
      const svg = wrapper.querySelector<SVGSVGElement>('svg')!
      root.scrollIntoView({ block: 'center' })
      wrapper.scrollLeft = wrapper.scrollWidth - wrapper.clientWidth
      const svgRect = svg.getBoundingClientRect()
      const wrapperRect = wrapper.getBoundingClientRect()
      return {
        diagramLeft: svgRect.left,
        viewportLeft: wrapperRect.left + wrapper.clientLeft,
        viewportWidth: wrapper.clientWidth,
        planeWidth: document.documentElement.clientWidth,
        scrollLeft: wrapper.scrollLeft,
      }
    })

    expect(source.scrollLeft).toBeGreaterThan(0)
    expect(source.diagramLeft).toBeLessThan(source.viewportLeft)
    expect(source.viewportWidth).toBe(298)
    expect(source.planeWidth).toBe(980)

    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('#diagram-root [aria-label="Expand diagram"]')!.click()
    })
    await page.waitForFunction(() => document.getAnimations().some((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target
      return target instanceof HTMLElement && target.classList.contains('ncm-expand-target')
    }))
    const transitionState = await page.evaluate(async () => {
      const animations = document.getAnimations().filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target
        return target instanceof HTMLElement
          && (target.classList.contains('ncm-expand-clip') || target.classList.contains('ncm-expand-target'))
      })
      for (const animation of animations) {
        animation.pause()
        animation.currentTime = 500
      }
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      return animations.map((animation) => {
        const effect = animation.effect as KeyframeEffect
        return {
          className: (effect.target as HTMLElement).className,
          properties: effect.getKeyframes().flatMap(frame => Object.keys(frame)),
        }
      })
    })

    const raster = await readRasterBounds(page, [13, 197, 97])
    expect(raster).not.toBeNull()
    expect(raster!.width).toBeCloseTo((source.viewportWidth + source.planeWidth) / 2, 0)
    expect(transitionState.some(state => state.className.includes('ncm-expand-clip') && state.properties.includes('clipPath'))).toBe(true)
  })

  it('keeps a centered diagram optically stationary while opening and closing', { timeout: 20000 }, async () => {
    const page = await createPage()
    await page.setViewportSize({ width: 1000, height: 800 })
    await page.goto(url('/'))
    await page.waitForSelector('#mock-svg-secondary', { state: 'visible', timeout: 5000 })
    await page.addStyleTag({
      content: `
        body {
          width: calc(100% - 20px);
        }
        html[style*="overflow: hidden"] body {
          width: 100%;
        }
        #secondary-root {
          width: 700px;
          margin-inline: auto;
        }
        .ncm-expand-clip,
        .ncm-expand-target {
          transition-duration: 1000ms !important;
          transition-timing-function: linear !important;
        }
        .ncm-expand-overlay {
          background: white !important;
          backdrop-filter: none !important;
          opacity: 1 !important;
        }
        .ncm-expand-target {
          background: rgb(187, 23, 211) !important;
        }
      `,
    })

    const sourceBefore = await page.evaluate(async () => {
      Object.defineProperty(document.documentElement, 'clientWidth', {
        configurable: true,
        get: () => document.documentElement.style.overflow === 'hidden'
          ? window.innerWidth
          : window.innerWidth - 20,
      })
      const root = document.querySelector<HTMLElement>('#secondary-root')!
      const source = root.querySelector<SVGSVGElement>('.mermaid > svg')!
      root.scrollIntoView({ block: 'center' })
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      const unalignedRect = source.getBoundingClientRect()
      const planeCenter = document.documentElement.clientWidth / 2
      root.style.transform = `translateX(${planeCenter - (unalignedRect.left + unalignedRect.width / 2)}px)`
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      const rect = source.getBoundingClientRect()
      const gutter = window.innerWidth - document.documentElement.clientWidth
      return {
        gutter,
        left: rect.left,
        center: rect.left + rect.width / 2,
      }
    })

    expect(sourceBefore.gutter).toBe(20)
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('#secondary-root [aria-label="Expand diagram"]')!.click()
    })
    const opening = await sampleExpandRasterCenters(page, [0, 250, 500, 750, 999], [187, 23, 211])
    const sourceWhileLocked = await page.locator('#mock-svg-secondary').evaluate((source) => {
      const rect = source.getBoundingClientRect()
      return { left: rect.left, center: rect.left + rect.width / 2 }
    })

    await page.evaluate(() => {
      document.getAnimations().forEach(animation => animation.finish())
    })
    await page.getByLabel('Minimize diagram').click()
    const closing = await sampleExpandRasterCenters(page, [0, 250, 500, 750, 999], [187, 23, 211])

    expect(sourceWhileLocked.left).toBeCloseTo(sourceBefore.left, 0)
    expect(Math.max(...opening.map(center => Math.abs(center - sourceBefore.center)))).toBeLessThanOrEqual(1)
    expect(Math.max(...closing.map(center => Math.abs(center - sourceBefore.center)))).toBeLessThanOrEqual(1)

    await page.evaluate(() => {
      document.getAnimations().forEach(animation => animation.finish())
    })
    await page.waitForSelector('.ncm-expand-modal', { state: 'detached', timeout: 5000 })
    const sourceAfter = await page.locator('#mock-svg-secondary').evaluate((source) => {
      const rect = source.getBoundingClientRect()
      return { left: rect.left, center: rect.left + rect.width / 2 }
    })
    expect(sourceAfter.left).toBeCloseTo(sourceBefore.left, 0)
    expect(sourceAfter.center).toBeCloseTo(sourceBefore.center, 0)
  })

  it.each([
    { label: 'a diagram without horizontal overflow', rootSelector: '#secondary-root', scrollPosition: 'left' },
    { label: 'the left edge of a horizontally scrollable diagram', rootSelector: '#diagram-root', scrollPosition: 'left' },
    { label: 'the right edge of a horizontally scrollable diagram', rootSelector: '#diagram-root', scrollPosition: 'right' },
  ])('opens $label from its visible source slice', { timeout: 20000 }, async ({ rootSelector, scrollPosition }) => {
    const page = await createPage()
    await page.goto(url('/'))
    await page.waitForSelector(`${rootSelector} .mermaid-wrapper svg`, { state: 'visible', timeout: 5000 })
    const transitionStyle = await page.addStyleTag({
      content: `
        .ncm-expand-clip,
        .ncm-expand-target {
          transition-duration: 3s !important;
          transition-timing-function: linear !important;
        }
      `,
    })

    const opening = await page.evaluate(async ({ rootSelector, scrollPosition }) => {
      const root = document.querySelector<HTMLElement>(rootSelector)!
      root.scrollIntoView({ block: 'center' })
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

      const wrapper = root.querySelector<HTMLElement>('.mermaid-wrapper')!
      const svg = wrapper.querySelector<SVGSVGElement>('.mermaid > svg')!
      wrapper.scrollLeft = scrollPosition === 'right'
        ? wrapper.scrollWidth - wrapper.clientWidth
        : 0

      const sourceRect = svg.getBoundingClientRect()
      const viewportRect = wrapper.getBoundingClientRect()
      const sourceClip = {
        top: Math.max(sourceRect.top, viewportRect.top + wrapper.clientTop, 0),
        left: Math.max(sourceRect.left, viewportRect.left + wrapper.clientLeft, 0),
        right: Math.min(sourceRect.right, viewportRect.left + wrapper.clientLeft + wrapper.clientWidth, window.innerWidth),
        bottom: Math.min(sourceRect.bottom, viewportRect.top + wrapper.clientTop + wrapper.clientHeight, window.innerHeight),
      }

      const cloneMounted = new Promise<void>((resolve) => {
        const observer = new MutationObserver(() => {
          if (!document.querySelector('.ncm-expand-target > svg')) return
          observer.disconnect()
          resolve()
        })
        observer.observe(document.body, { childList: true, subtree: true })
      })

      root.querySelector<HTMLButtonElement>('[aria-label="Expand diagram"]')!.click()
      await cloneMounted
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

      const clip = document.querySelector<HTMLElement>('.ncm-expand-clip')!
      const clipRect = clip.getBoundingClientRect()
      const values = getComputedStyle(clip).clipPath.match(/^inset\((.+)\)$/)![1]!.split(/\s+/).map(Number.parseFloat)
      const clipTop = values[0]!
      const clipRight = values[1] ?? clipTop
      const clipBottom = values[2] ?? clipTop
      const clipLeft = values[3] ?? clipRight
      const targetRect = document.querySelector<HTMLElement>('.ncm-expand-target')!.getBoundingClientRect()
      return {
        source: {
          top: sourceRect.top,
          left: sourceRect.left,
          width: sourceRect.width,
          height: sourceRect.height,
        },
        expectedClip: {
          top: sourceClip.top,
          left: sourceClip.left,
          width: sourceClip.right - sourceClip.left,
          height: sourceClip.bottom - sourceClip.top,
        },
        clip: {
          top: clipRect.top + clipTop,
          left: clipRect.left + clipLeft,
          width: clipRect.width - clipLeft - clipRight,
          height: clipRect.height - clipTop - clipBottom,
        },
        target: {
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
        },
      }
    }, { rootSelector, scrollPosition })

    await transitionStyle.evaluate(style => style.parentNode?.removeChild(style))
    await page.evaluate(() => {
      document.getAnimations().forEach(animation => animation.finish())
    })
    const destination = await page.evaluate(() => {
      const clip = document.querySelector<HTMLElement>('.ncm-expand-clip')!
      const clipRect = clip.getBoundingClientRect()
      const values = getComputedStyle(clip).clipPath.match(/^inset\((.+)\)$/)![1]!.split(/\s+/).map(Number.parseFloat)
      const clipTop = values[0]!
      const clipRight = values[1] ?? clipTop
      const clipBottom = values[2] ?? clipTop
      const clipLeft = values[3] ?? clipRight
      const targetRect = document.querySelector<HTMLElement>('.ncm-expand-target')!.getBoundingClientRect()
      return {
        clip: {
          top: clipRect.top + clipTop,
          left: clipRect.left + clipLeft,
          width: clipRect.width - clipLeft - clipRight,
          height: clipRect.height - clipTop - clipBottom,
        },
        target: { top: targetRect.top, left: targetRect.left, width: targetRect.width, height: targetRect.height },
      }
    })

    expect(rectDistance(opening.target, opening.source)).toBeLessThan(rectDistance(opening.target, destination.target))
    expect(rectDistance(opening.clip, opening.expectedClip)).toBeLessThan(rectDistance(opening.clip, destination.clip))

    await page.getByLabel('Minimize diagram').click()
    await page.waitForSelector('.ncm-expand-modal', { state: 'detached', timeout: 5000 })
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
          const clipRect = clip.getBoundingClientRect()
          const inlineInsets = clip.style.clipPath.match(/^inset\((.+)\)$/)![1]!.split(/\s+/).map(Number.parseFloat)
          const computedInsets = getComputedStyle(clip).clipPath.match(/^inset\((.+)\)$/)![1]!.split(/\s+/).map(Number.parseFloat)
          const inlineRight = inlineInsets[1] ?? inlineInsets[0]!
          const inlineLeft = inlineInsets[3] ?? inlineRight
          const computedRight = computedInsets[1] ?? computedInsets[0]!
          const computedLeft = computedInsets[3] ?? computedRight
          if (!Number.isFinite(destinationLeft)) destinationLeft = clipRect.left + inlineLeft
          samples.push(clipRect.left + computedLeft)
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
