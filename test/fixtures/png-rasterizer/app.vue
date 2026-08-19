<script setup lang="ts">
import { onMounted, ref } from 'vue'
import snapshotSource from './committed-mermaid-snapshot.svg?raw'

interface PixelData {
  width: number
  height: number
  data: Uint8ClampedArray
}

interface Region {
  x: number
  y: number
  width: number
  height: number
}

interface Difference {
  pixels: number
  differentPixels: number
  ratio: number
  maxChannelDelta: number
}

interface RasterizationResult {
  success: boolean
  error?: string
  outputCount: number
  snapshotSha256?: string
  expectedDimensions?: { width: number, height: number }
  actualDimensions?: Array<{ width: number, height: number }>
  pixelHashes?: string[]
  repeatedOutputDifferences?: Difference[]
  features?: {
    foreignObjectCount: number
    chineseForeignObjects: number
    multilineForeignObjects: number
    boldForeignObjects: number
    boldWeight: number
  }
  sanitizerGate?: {
    scripts: number
    eventAttributes: number
    externalReferences: string[]
    externalCssUrls: number
  }
  assertions?: {
    dimensionsConsistent: boolean
    transparent: boolean
    nonblank: boolean
    featureContentVisible: boolean
    webfontReady: boolean
    webfontApplied: boolean
    repeatedOutputConsistent: boolean
    sourceSnapshotUnchanged: boolean
  }
  diagnostics?: {
    opaqueRatio: number
    cornerAlpha: number[]
    featureDifference: Difference
    fontDifference: Difference
    computedFontFamily: string
  }
}

declare global {
  interface Window {
    __pngRasterizerFixture__?: {
      run: () => Promise<RasterizationResult>
    }
  }
}

const status = ref<'loading' | 'ready' | 'error'>('loading')
const setupError = ref('')
const MAX_CHANNEL_DELTA = 8
const MAX_REPEAT_DIFF_RATIO = 0.0001

function stylesheetUrl(mode: string, fontBase: string) {
  if (mode === 'same-origin') return '/fixture-fonts.css'
  if (mode === 'readable-import') return '/fixture-import.css'
  if (mode === 'cors' || mode === 'blocked-stylesheet') {
    return `${fontBase}/fixture-fonts.css`
  }
  throw new Error(`Unknown font mode: ${mode}`)
}

async function loadFontStylesheet(mode: string, fontBase: string) {
  await new Promise<void>((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = stylesheetUrl(mode, fontBase)
    if (mode === 'cors') link.crossOrigin = 'anonymous'
    link.onload = () => resolve()
    link.onerror = () => reject(new Error(`Could not load ${link.href}`))
    document.head.append(link)
  })
}

function parseAndValidateSnapshot(source: string) {
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml')
  const root = parsed.documentElement
  if (root.localName !== 'svg') throw new Error('Snapshot root is not SVG')

  const elements = [root, ...root.querySelectorAll('*')]
  const eventAttributes = elements.flatMap(element => [...element.attributes])
    .filter(attribute => attribute.name.toLowerCase().startsWith('on'))
  const externalReferences = elements.flatMap(element => ['href', 'src']
    .map(name => element.getAttribute(name))
    .filter((value): value is string => Boolean(value)))
    .filter(value => !value.startsWith('#') && !value.startsWith('data:'))
  const externalCssUrls = [...source.matchAll(/url\(\s*["']?(https?:|\/\/)/gi)]

  const sanitizerGate = {
    scripts: root.querySelectorAll('script').length,
    eventAttributes: eventAttributes.length,
    externalReferences,
    externalCssUrls: externalCssUrls.length,
  }

  if (sanitizerGate.scripts !== 0
    || sanitizerGate.eventAttributes !== 0
    || sanitizerGate.externalReferences.length !== 0
    || sanitizerGate.externalCssUrls !== 0) {
    throw new Error(`Snapshot failed sanitizer gate: ${JSON.stringify(sanitizerGate)}`)
  }

  return { root: root as unknown as SVGSVGElement, sanitizerGate }
}

async function sha256(value: string | ArrayBufferView) {
  const sourceBytes = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  const bytes = new Uint8Array(sourceBytes.byteLength)
  bytes.set(sourceBytes)
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer)
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function blobPixels(blob: Blob): Promise<PixelData> {
  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D context is unavailable')
    context.drawImage(image, 0, 0)
    return {
      width: canvas.width,
      height: canvas.height,
      data: context.getImageData(0, 0, canvas.width, canvas.height).data,
    }
  }
  finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function pixelDifference(
  left: PixelData,
  right: PixelData,
  regions: Region[],
): Difference {
  if (left.width !== right.width || left.height !== right.height) {
    return {
      pixels: left.width * left.height,
      differentPixels: left.width * left.height,
      ratio: 1,
      maxChannelDelta: 255,
    }
  }

  const visited = new Uint8Array(left.width * left.height)
  let pixels = 0
  let differentPixels = 0
  let maxChannelDelta = 0

  for (const region of regions) {
    const startX = Math.max(0, Math.floor(region.x))
    const endX = Math.min(left.width, Math.ceil(region.x + region.width))
    const startY = Math.max(0, Math.floor(region.y))
    const endY = Math.min(left.height, Math.ceil(region.y + region.height))

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const pixelIndex = y * left.width + x
        if (visited[pixelIndex]) continue
        visited[pixelIndex] = 1
        pixels++

        const offset = pixelIndex * 4
        let pixelDifferent = false
        for (let channel = 0; channel < 4; channel++) {
          const delta = Math.abs(left.data[offset + channel]! - right.data[offset + channel]!)
          maxChannelDelta = Math.max(maxChannelDelta, delta)
          if (delta > MAX_CHANNEL_DELTA) pixelDifferent = true
        }
        if (pixelDifferent) differentPixels++
      }
    }
  }

  return {
    pixels,
    differentPixels,
    ratio: pixels === 0 ? 0 : differentPixels / pixels,
    maxChannelDelta,
  }
}

function contentMetrics(pixels: PixelData) {
  let opaquePixels = 0
  for (let offset = 3; offset < pixels.data.length; offset += 4) {
    if (pixels.data[offset]! > 0) opaquePixels++
  }

  const lastX = pixels.width - 1
  const lastY = pixels.height - 1
  const alphaAt = (x: number, y: number) => pixels.data[(y * pixels.width + x) * 4 + 3]!
  return {
    opaqueRatio: opaquePixels / (pixels.width * pixels.height),
    cornerAlpha: [
      alphaAt(0, 0),
      alphaAt(lastX, 0),
      alphaAt(0, lastY),
      alphaAt(lastX, lastY),
    ],
  }
}

function featureInventory(svg: SVGSVGElement) {
  const foreignObjects = [...svg.querySelectorAll('foreignObject')]
  const hasChinese = (element: Element) => /[\u3400-\u9FFF]/u.test(element.textContent ?? '')
  const featureIndices = [...new Set([
    foreignObjects.findIndex(hasChinese),
    foreignObjects.findIndex(element => Boolean(element.querySelector('br'))),
    foreignObjects.findIndex(element => Boolean(element.querySelector('strong, b'))),
  ].filter(index => index >= 0))]

  return {
    foreignObjects,
    featureIndices,
    summary: {
      foreignObjectCount: foreignObjects.length,
      chineseForeignObjects: foreignObjects.filter(hasChinese).length,
      multilineForeignObjects: foreignObjects.filter(element => element.querySelector('br')).length,
      boldForeignObjects: foreignObjects.filter(element => element.querySelector('strong, b')).length,
    },
  }
}

function parseDimensions(svg: SVGSVGElement) {
  const viewBox = (svg.getAttribute('viewBox') ?? '')
    .trim()
    .split(/\s+/)
    .map(Number)
  const width = Math.round(viewBox[2] ?? Number.NaN)
  const height = Math.round(viewBox[3] ?? Number.NaN)
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new TypeError('Snapshot has invalid viewBox dimensions')
  }
  return { width, height }
}

onMounted(async () => {
  try {
    const query = new URLSearchParams(location.search)
    const mode = query.get('font') ?? 'same-origin'
    const fontBase = query.get('fontBase') ?? ''
    await loadFontStylesheet(mode, fontBase)

    const { root, sanitizerGate } = parseAndValidateSnapshot(snapshotSource)
    const svg = document.importNode(root, true)
    const { width, height } = parseDimensions(svg)
    const host = document.querySelector<HTMLElement>('#snapshot-host')
    if (!host) throw new Error('Snapshot host is missing')
    host.style.width = `${width}px`
    host.style.height = `${height}px`
    host.append(svg)

    const features = featureInventory(svg)
    const sampleText = (svg.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (mode !== 'blocked-stylesheet') {
      await document.fonts.load('400 16px "Noto Sans TC"', sampleText)
      await document.fonts.load('700 16px "Noto Sans TC"', sampleText)
    }
    await document.fonts.ready

    const { rasterizePngSnapshot } = await import('../../../src/runtime/png-rasterizer')

    window.__pngRasterizerFixture__ = {
      async run() {
        let outputCount = 0
        try {
          const sourceSnapshot = svg.outerHTML
          const hostRect = host.getBoundingClientRect()
          const featureRegions = features.featureIndices.map((index) => {
            const rect = features.foreignObjects[index]!.getBoundingClientRect()
            return {
              x: rect.left - hostRect.left,
              y: rect.top - hostRect.top,
              width: rect.width,
              height: rect.height,
            }
          })

          const blobs: Blob[] = []
          for (let run = 0; run < 3; run++) {
            blobs.push(await rasterizePngSnapshot({ svg, width, height }))
            outputCount++
          }
          const actualPixels = await Promise.all(blobs.map(blobPixels))
          const pixelHashes = await Promise.all(actualPixels.map(pixels => sha256(pixels.data)))

          const hiddenSvg = svg.cloneNode(true) as SVGSVGElement
          const hiddenForeignObjects = [...hiddenSvg.querySelectorAll('foreignObject')]
          for (const index of features.featureIndices) {
            hiddenForeignObjects[index]!.style.visibility = 'hidden'
          }
          const hiddenPixels = await blobPixels(await rasterizePngSnapshot({
            svg: hiddenSvg,
            width,
            height,
          }))
          outputCount++

          const fallbackSvg = svg.cloneNode(true) as SVGSVGElement
          for (const element of [fallbackSvg, ...fallbackSvg.querySelectorAll('*')]) {
            ;(element as HTMLElement).style.setProperty('font-family', 'monospace', 'important')
          }
          const fallbackPixels = await blobPixels(await rasterizePngSnapshot({
            svg: fallbackSvg,
            width,
            height,
          }))
          outputCount++

          const actualDimensions = actualPixels.map(pixels => ({
            width: pixels.width,
            height: pixels.height,
          }))
          const repeatedOutputDifferences = actualPixels.slice(1).map((pixels, index) =>
            pixelDifference(actualPixels[index]!, pixels, [{ x: 0, y: 0, width, height }]))
          const metrics = contentMetrics(actualPixels[0]!)
          const featureDifference = pixelDifference(actualPixels[0]!, hiddenPixels, featureRegions)
          const fontDifference = pixelDifference(actualPixels[0]!, fallbackPixels, featureRegions)
          const strong = svg.querySelector('strong, b')
          const boldWeight = strong
            ? Number.parseInt(getComputedStyle(strong).fontWeight, 10)
            : 0
          const computedFontFamily = getComputedStyle(
            svg.querySelector('foreignObject *') ?? svg,
          ).fontFamily
          const webfontReady = document.fonts.check('400 16px "Noto Sans TC"', sampleText)
            && document.fonts.check('700 16px "Noto Sans TC"', sampleText)
            && computedFontFamily.includes('Noto Sans TC')
          const assertions = {
            dimensionsConsistent: actualDimensions.every(size => size.width === width && size.height === height),
            transparent: metrics.cornerAlpha.every(alpha => alpha === 0),
            nonblank: metrics.opaqueRatio > 0.01,
            featureContentVisible: featureDifference.ratio > 0.001,
            webfontReady,
            webfontApplied: fontDifference.ratio > 0.001,
            repeatedOutputConsistent: repeatedOutputDifferences
              .every(difference => difference.ratio < MAX_REPEAT_DIFF_RATIO),
            sourceSnapshotUnchanged: svg.outerHTML === sourceSnapshot,
          }

          return {
            success: Object.values(assertions).every(Boolean) && boldWeight >= 600,
            outputCount,
            snapshotSha256: await sha256(snapshotSource),
            expectedDimensions: { width, height },
            actualDimensions,
            pixelHashes,
            repeatedOutputDifferences,
            features: { ...features.summary, boldWeight },
            sanitizerGate,
            assertions,
            diagnostics: {
              ...metrics,
              featureDifference,
              fontDifference,
              computedFontFamily,
            },
          }
        }
        catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            outputCount,
          }
        }
      },
    }

    status.value = 'ready'
  }
  catch (error) {
    setupError.value = error instanceof Error ? error.message : String(error)
    status.value = 'error'
  }
})
</script>

<template>
  <main>
    <p data-testid="status">
      {{ status }}
    </p>
    <pre
      v-if="setupError"
      data-testid="setup-error"
    >{{ setupError }}</pre>
    <div id="snapshot-host" />
  </main>
</template>

<style>
html,
body,
#snapshot-host {
  margin: 0;
  padding: 0;
  background: transparent;
}

#snapshot-host svg {
  display: block;
}
</style>
