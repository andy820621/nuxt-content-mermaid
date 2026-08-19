import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setup, url } from '@nuxt/test-utils/e2e'
import { chromium, firefox, webkit } from 'playwright'
import type { BrowserType } from 'playwright'
import { afterAll, describe, expect, it } from 'vitest'
import { startFontFixtureServer } from './helpers/fontFixtureServer'

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/png-rasterizer')
const snapshotPath = resolve(fixtureDir, 'committed-mermaid-snapshot.svg')
const EXPECTED_SNAPSHOT_SHA256 = '089c945440a4fe47776db4055ff344172f29b630b9f633036233f0865aa7e24c'
const MAX_REPEAT_DIFF_RATIO = 0.0001

interface GateResult {
  success: boolean
  error?: string
  outputCount: number
  snapshotSha256?: string
  expectedDimensions?: { width: number, height: number }
  actualDimensions?: Array<{ width: number, height: number }>
  pixelHashes?: string[]
  repeatedOutputDifferences?: Array<{
    ratio: number
    maxChannelDelta: number
  }>
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
  assertions?: Record<string, boolean>
  diagnostics?: Record<string, unknown>
}

const engines: Array<[string, BrowserType]> = [
  ['Chromium', chromium],
  ['Firefox', firefox],
  ['WebKit', webkit],
]

describe('committed Mermaid SVG snapshot PNG browser contract', async () => {
  const corsFonts = await startFontFixtureServer({ cors: true })
  const blockedFonts = await startFontFixtureServer({ cors: false })

  afterAll(async () => {
    await Promise.all([corsFonts.close(), blockedFonts.close()])
  })

  await setup({
    rootDir: fixtureDir,
  })

  it('pins the sanitized real Mermaid fixture and html-to-image dependency', async () => {
    const { createHash } = await import('node:crypto')
    const snapshot = await readFile(snapshotPath)
    const packageJson = JSON.parse(await readFile(resolve(fixtureDir, '../../../package.json'), 'utf8'))

    expect(createHash('sha256').update(snapshot).digest('hex')).toBe(EXPECTED_SNAPSHOT_SHA256)
    expect(packageJson.dependencies['html-to-image']).toBe('1.11.11')
  })

  it.each(engines)('%s preserves the approved PNG fidelity and failure gates', {
    timeout: 180_000,
  }, async (_name, browserType) => {
    const browser = await browserType.launch({ headless: true })

    try {
      for (const [mode, fontBase] of [
        ['same-origin', ''],
        ['cors', corsFonts.origin],
      ] as const) {
        const page = await browser.newPage()
        try {
          const target = new URL(url('/'))
          target.searchParams.set('font', mode)
          if (fontBase) target.searchParams.set('fontBase', fontBase)
          await page.goto(target.href)
          await page.waitForFunction(() => {
            return document.querySelector('[data-testid="status"]')?.textContent?.trim() !== 'loading'
          })

          expect(await page.locator('[data-testid="status"]').textContent()).toContain('ready')
          const result = await page.evaluate(async () => {
            return window.__pngRasterizerFixture__!.run()
          }) as GateResult

          expect(result, JSON.stringify(result, null, 2)).toMatchObject({
            success: true,
            outputCount: 5,
            snapshotSha256: EXPECTED_SNAPSHOT_SHA256,
            expectedDimensions: { width: 1445, height: 477 },
            actualDimensions: [
              { width: 1445, height: 477 },
              { width: 1445, height: 477 },
              { width: 1445, height: 477 },
            ],
            features: {
              foreignObjectCount: 11,
              chineseForeignObjects: 9,
              multilineForeignObjects: 8,
              boldForeignObjects: 8,
            },
            sanitizerGate: {
              scripts: 0,
              eventAttributes: 0,
              externalReferences: [],
              externalCssUrls: 0,
            },
            assertions: {
              dimensionsConsistent: true,
              transparent: true,
              nonblank: true,
              featureContentVisible: true,
              webfontReady: true,
              webfontApplied: true,
              repeatedOutputConsistent: true,
            },
          })
          expect(result.features!.boldWeight).toBeGreaterThanOrEqual(600)
          expect(result.pixelHashes).toHaveLength(3)
          expect(result.repeatedOutputDifferences).toHaveLength(2)
          for (const difference of result.repeatedOutputDifferences!) {
            expect(difference.ratio).toBeLessThan(MAX_REPEAT_DIFF_RATIO)
          }
        }
        finally {
          await page.close()
        }
      }

      const blockedPage = await browser.newPage()
      try {
        const target = new URL(url('/'))
        target.searchParams.set('font', 'blocked-stylesheet')
        target.searchParams.set('fontBase', blockedFonts.origin)
        await blockedPage.goto(target.href)
        await blockedPage.waitForFunction(() => {
          return document.querySelector('[data-testid="status"]')?.textContent?.trim() !== 'loading'
        })
        expect(await blockedPage.locator('[data-testid="status"]').textContent()).toContain('ready')

        const result = await blockedPage.evaluate(async () => {
          return window.__pngRasterizerFixture__!.run()
        }) as GateResult
        expect(result).toMatchObject({
          success: false,
          outputCount: 0,
        })
        expect(result.error).toContain(
          '[nuxt-content-mermaid] Cannot read stylesheet for PNG rasterization:',
        )
      }
      finally {
        await blockedPage.close()
      }
    }
    finally {
      await browser.close()
    }
  })
})
