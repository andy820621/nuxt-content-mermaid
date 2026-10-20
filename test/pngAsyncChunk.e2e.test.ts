import { readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  $fetch,
  createPage,
  setup,
  url,
  useTestContext,
} from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/png-async-chunk')
const HTML_TO_IMAGE_MARKER = 'Error inlining remote css file'
const CONTROL_PREFETCH_MARKER = 'nuxt-content-mermaid-control-prefetch'

function findResourceHint(html: string, asset: string) {
  return html.match(/<link\b[^>]*>/g)
    ?.find(tag => tag.includes(asset))
}

describe('PNG production async chunk', async () => {
  await setup({
    rootDir: fixtureDir,
    browser: true,
    dev: false,
    setupTimeout: 240_000,
  })

  it('loads html-to-image only on the first PNG download', { timeout: 60_000 }, async () => {
    const buildDir = useTestContext().nuxt!.options.buildDir
    const assetDir = resolve(buildDir, 'output/public/_nuxt')
    const assetNames = (await readdir(assetDir)).filter(name => name.endsWith('.js'))
    const htmlToImageAssets: string[] = []
    const controlAssets: string[] = []

    for (const name of assetNames) {
      const source = await readFile(resolve(assetDir, name), 'utf8')
      if (source.includes(HTML_TO_IMAGE_MARKER)) htmlToImageAssets.push(name)
      if (source.includes(CONTROL_PREFETCH_MARKER)) controlAssets.push(name)
    }

    expect(htmlToImageAssets).toHaveLength(1)
    expect(controlAssets).toHaveLength(1)
    const htmlToImageAsset = htmlToImageAssets[0]!
    const controlAsset = controlAssets[0]!
    const initialHtml = await $fetch<string>('/')
    expect(initialHtml).not.toContain(htmlToImageAsset)
    expect(findResourceHint(initialHtml, controlAsset)).toMatch(
      /\brel=(?:"prefetch"|'prefetch')/,
    )

    const requestedAssets: string[] = []
    const page = await createPage()
    page.on('request', (request) => {
      requestedAssets.push(new URL(request.url()).pathname)
    })

    await page.goto(url('/'), { waitUntil: 'networkidle' })
    const diagram = page.locator('.mermaid-wrapper svg')
    await diagram.waitFor()
    expect(requestedAssets.some(path => path.endsWith(`/${htmlToImageAsset}`))).toBe(false)

    const downloadTrigger = page.getByRole('button', { name: 'Download diagram' })
    await downloadTrigger.click()
    const svgDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download as SVG' }).click()
    await svgDownload
    expect(requestedAssets.some(path => path.endsWith(`/${htmlToImageAsset}`))).toBe(false)

    await downloadTrigger.click()
    const firstPngDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download as PNG' }).click()
    expect((await firstPngDownload).suggestedFilename()).toBe('mermaid-diagram.png')
    expect(requestedAssets.filter(path => path.endsWith(`/${htmlToImageAsset}`))).toHaveLength(1)

    await downloadTrigger.click()
    const secondPngDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download as PNG' }).click()
    expect((await secondPngDownload).suggestedFilename()).toBe('mermaid-diagram.png')
    expect(requestedAssets.filter(path => path.endsWith(`/${htmlToImageAsset}`))).toHaveLength(1)
  })

  it('keeps SVG download available after a PNG chunk load failure', { timeout: 60_000 }, async () => {
    const assetDir = resolve(useTestContext().nuxt!.options.buildDir, 'output/public/_nuxt')
    const assetNames = (await readdir(assetDir)).filter(name => name.endsWith('.js'))
    const assetSources = await Promise.all(assetNames.map(name => readFile(resolve(assetDir, name), 'utf8')))
    const pngAsset = assetNames.find((_, index) => assetSources[index]!.includes(HTML_TO_IMAGE_MARKER))
    expect(pngAsset).toBeDefined()

    const page = await createPage()
    let importRequests = 0
    const downloads: string[] = []
    const pngErrors: string[] = []
    page.on('download', (download) => {
      downloads.push(download.suggestedFilename())
    })
    page.on('console', (message) => {
      if (message.text().includes('[nuxt-content-mermaid] Failed to download PNG:'))
        pngErrors.push(message.text())
    })
    await page.route(`**/_nuxt/${pngAsset}`, async (route) => {
      importRequests++
      if (importRequests === 1) await route.abort('connectionreset')
      else await route.continue()
    })
    await page.goto(url('/'), { waitUntil: 'networkidle' })
    const diagram = page.locator('.mermaid-wrapper svg')
    await diagram.waitFor()
    const originalDiagram = await diagram.elementHandle()

    const trigger = page.getByRole('button', { name: 'Download diagram' })
    await trigger.click()
    const failure = page.waitForEvent('console', {
      predicate: message => message.text().includes('[nuxt-content-mermaid] Failed to download PNG:'),
    })
    await page.getByRole('button', { name: 'Download as PNG' }).click()
    await failure
    expect(downloads).toEqual([])
    expect(pngErrors).toHaveLength(1)
    expect(importRequests).toBe(1)

    await trigger.click()
    const fallback = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download as SVG' }).click()
    expect((await fallback).suggestedFilename()).toBe('mermaid-diagram.svg')
    expect(await originalDiagram?.evaluate(element => element.isConnected)).toBe(true)
  })
})
