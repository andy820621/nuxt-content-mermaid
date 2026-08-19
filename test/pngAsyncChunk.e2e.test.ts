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
    expect(initialHtml).toContain(controlAsset)

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
})
