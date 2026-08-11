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
})
