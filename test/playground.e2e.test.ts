import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { createPage, setup, url } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../playground')
type BrowserPage = Awaited<ReturnType<typeof createPage>>

async function downloadSvg(page: BrowserPage, selector: string) {
  const downloadPromise = page.waitForEvent('download')
  await page.locator(selector).click()
  const download = await downloadPromise
  const downloadPath = await download.path()
  if (!downloadPath) throw new Error('Expected the SVG download to have a local path')
  return {
    filename: download.suggestedFilename(),
    text: await readFile(downloadPath, 'utf8'),
  }
}

describe('playground integration', async () => {
  await setup({
    rootDir,
    browser: true,
  })

  it('renders adjacent diagrams while presenting the parser error and full diagnostics', { timeout: 30000 }, async () => {
    const page = await createPage()
    const response = await page.goto(url('/test-debug'))
    expect(response?.status()).toBe(200)

    const blockAfterHeading = (headingId: string) => page
      .locator(`#${headingId}`)
      .locator('xpath=following-sibling::*[1]')
      .locator('.mermaid-block')

    const normalBlock = blockAfterHeading('normal-chart-should-log-render-time')
    const syntaxErrorBlock = blockAfterHeading('syntax-error-chart-should-display-full-error-stack')
    const queuedBlock = blockAfterHeading('another-normal-chart-test-queue-mechanism')

    await normalBlock.locator('.mermaid > svg').waitFor({ state: 'visible', timeout: 10000 })
    await syntaxErrorBlock.locator('.mermaid-error').waitFor({ state: 'visible', timeout: 10000 })
    await queuedBlock.scrollIntoViewIfNeeded()
    await queuedBlock.locator('.mermaid > svg').waitFor({ state: 'visible', timeout: 10000 })

    expect(await syntaxErrorBlock.locator('.mermaid > svg').count()).toBe(0)
    expect(await syntaxErrorBlock.locator('.mermaid-error__stack').textContent()).toContain('Parse error')
    expect(await syntaxErrorBlock.locator('details code').textContent()).toContain('A --')
  })

  it('keeps the startup snapshot while showing page, direct, and conflict recovery paths', { timeout: 30000 }, async () => {
    const page = await createPage()

    const contentPageResponse = await page.goto(url('/migration-page-config'))
    expect(contentPageResponse?.status()).toBe(200)
    await page.locator('.mermaid-title').getByText('Page Mermaid Config').waitFor()
    const pageConfigStyles = await page.locator('.mermaid svg').evaluate((svg) => {
      const styles = svg.querySelector('style')?.textContent ?? ''
      return [...new Set(styles.match(/(?:fill|stroke):#[0-9a-f]{6}/g))]
    })
    expect(pageConfigStyles).toContain('fill:#cde498')

    await page.goto(url('/migration'))

    await page.locator('#direct-config-example .mermaid-title').getByText('Direct Mermaid Config').waitFor()
    const directConfigStyles = await page.locator('#direct-config-example .mermaid svg').evaluate((svg) => {
      const styles = svg.querySelector('style')?.textContent ?? ''
      return [...new Set(styles.match(/(?:fill|stroke):#[0-9a-f]{6}/g))]
    })
    expect(directConfigStyles).toContain('fill:#1f2020')

    await page.locator('#mutate-runtime-transport').click()
    expect(await page.locator('#runtime-transport-value').textContent()).toBe('changed after startup')

    await page.locator('#mount-after-runtime-mutation').click()
    await page.locator('#snapshot-after-mutation .mermaid-title').getByText('Snapshot at app initialization').waitFor()

    const recoverySvg = page.locator('#conflict-recovery-example .mermaid svg')
    const renderedText = () => recoverySvg.textContent()
    const renderedId = () => recoverySvg.getAttribute('id')
    const conflictCount = () => page.locator('#source-conflict-count').textContent()
    const recoveryPhase = () => page.locator('#source-conflict-phase').textContent()

    await page.locator('#conflict-recovery-example').scrollIntoViewIfNeeded()
    await recoverySvg.waitFor({ state: 'visible', timeout: 10000 })
    expect(await renderedText()).toContain('DIRECT')
    expect(await renderedText()).toContain('ACTIVE')
    expect(await recoveryPhase()).toBe('direct')
    const initialSvgId = await renderedId()

    await page.locator('#enter-source-conflict').click()
    await expect.poll(conflictCount).toBe('1')
    expect(await renderedId()).toBe(initialSvgId)
    expect(await renderedText()).toContain('DIRECT')
    expect(await recoveryPhase()).toBe('conflict')

    await page.locator('#enter-source-conflict').click()
    expect(await conflictCount()).toBe('1')

    await page.locator('#recover-source-conflict').click()
    await page.locator('#conflict-recovery-example .mermaid-title').getByText('Direct Mermaid Config').waitFor()
    await expect.poll(renderedId).not.toBe(initialSvgId)
    expect(await renderedText()).toContain('RECOVERED')
    expect(await renderedText()).toContain('DIRECT')
    expect(await recoveryPhase()).toBe('recovered')
    const recoveredSvgId = await renderedId()

    await page.locator('#enter-source-conflict').click()
    await expect.poll(conflictCount).toBe('2')
    expect(await renderedId()).toBe(recoveredSvgId)
    expect(await renderedText()).toContain('RECOVERED')
    expect(await recoveryPhase()).toBe('conflict')
  })

  it('downloads the sanitized committed SVG without changing Mermaid HTML labels', { timeout: 30000 }, async () => {
    const page = await createPage()
    const response = await page.goto(url('/mermaid/classdiagram/finance-ledger'))
    expect(response?.status()).toBe(200)

    const block = page.locator('.mermaid-block')
    const visibleSvg = block.locator('.mermaid > svg')
    await block.scrollIntoViewIfNeeded()
    await visibleSvg.waitFor({ state: 'visible', timeout: 15000 })
    expect(await visibleSvg.locator('foreignObject').count()).toBeGreaterThan(0)

    const downloadTrigger = block.getByLabel('Download diagram')
    await downloadTrigger.click()
    const svgDownload = await downloadSvg(
      page,
      '.mermaid-block [aria-label="Download as SVG"]',
    )

    const inspectSvg = (text: string) => page.evaluate((svgText) => {
      const document = new DOMParser().parseFromString(svgText, 'image/svg+xml')
      return {
        parserErrors: document.querySelectorAll('parsererror').length,
        rootNamespace: document.documentElement.namespaceURI,
        foreignObjects: document.querySelectorAll('foreignObject').length,
        nativeText: document.querySelectorAll('text, tspan').length,
        textContent: document.documentElement.textContent ?? '',
        xhtmlNamespace: document.querySelector('foreignObject > *')?.namespaceURI,
      }
    }, text)

    const downloaded = await inspectSvg(svgDownload.text)

    expect(svgDownload.filename).toBe('mermaid-diagram.svg')
    expect(downloaded).toMatchObject({
      parserErrors: 0,
      rootNamespace: 'http://www.w3.org/2000/svg',
      xhtmlNamespace: 'http://www.w3.org/1999/xhtml',
    })
    expect(downloaded.foreignObjects).toBeGreaterThan(0)
    expect(downloaded.textContent).toContain('User')
    expect(downloaded.textContent).toContain('Transaction')
    expect(downloaded.textContent).toContain('Budget')
    expect(await visibleSvg.locator('foreignObject').count()).toBeGreaterThan(0)
  })
})
