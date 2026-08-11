import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createPage, setup, url } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../playground')

describe('v3 migration playground', async () => {
  await setup({
    rootDir,
    browser: true,
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

  it('keeps the class diagram on the content axis throughout expand and minimize', { timeout: 30000 }, async () => {
    const page = await createPage()
    const response = await page.goto(url('/mermaid/classdiagram/finance-ledger'))
    expect(response?.status()).toBe(200)

    const block = page.locator('.mermaid-block')
    await block.scrollIntoViewIfNeeded()
    await block.locator('.mermaid > svg').waitFor({ state: 'visible', timeout: 15000 })
    await page.addStyleTag({
      content: `
        html {
          width: calc(100% - 15px);
        }
        .ncm-expand-clip,
        .ncm-expand-target {
          transition-duration: 600ms !important;
          transition-timing-function: linear !important;
        }
      `,
    })

    const result = await page.evaluate(async () => {
      Object.defineProperty(document.documentElement, 'clientWidth', {
        configurable: true,
        get: () => window.innerWidth - 15,
      })
      const centerX = (element: Element) => {
        const rect = element.getBoundingClientRect()
        return rect.left + rect.width / 2
      }
      const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      const source = document.querySelector<SVGSVGElement>('.mermaid-block .mermaid > svg')!
      const sourceCenter = centerX(source)
      const gutter = window.innerWidth - document.documentElement.clientWidth

      document.querySelector<HTMLButtonElement>('.mermaid-block [aria-label="Expand diagram"]')!.click()
      const opening: number[] = []
      for (let index = 0; index < 48; index++) {
        await nextFrame()
        const target = document.querySelector<HTMLElement>('.ncm-expand-target')
        if (target) opening.push(centerX(target))
      }

      document.querySelector<HTMLButtonElement>('[aria-label="Minimize diagram"]')!.click()
      const closing: number[] = []
      for (let index = 0; index < 48; index++) {
        await nextFrame()
        const target = document.querySelector<HTMLElement>('.ncm-expand-target')
        if (target) closing.push(centerX(target))
      }

      return { sourceCenter, gutter, innerWidth: window.innerWidth, opening, closing }
    })

    expect(result.gutter).toBeGreaterThan(0)
    expect(result.sourceCenter).toBeCloseTo((result.innerWidth - result.gutter) / 2, 0)
    expect(result.opening.length).toBeGreaterThan(2)
    expect(result.closing.length).toBeGreaterThan(2)
    expect(Math.max(...result.opening.map(center => Math.abs(center - result.sourceCenter)))).toBeLessThanOrEqual(0.25)
    expect(Math.max(...result.closing.map(center => Math.abs(center - result.sourceCenter)))).toBeLessThanOrEqual(0.25)
  })
})
