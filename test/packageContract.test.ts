import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('package root runtime contract', () => {
  it('exposes the Nuxt module without the legacy package-root transform export', async () => {
    const packageModule = await import('@barzhsieh/nuxt-content-mermaid')

    expect(packageModule.default).toBeDefined()
    expect('transformMermaidCodeBlocks' in packageModule).toBe(false)
  })

  it('publishes the v3 configuration type contract', () => {
    const declaration = readFileSync(new URL('../dist/module.d.mts', import.meta.url), 'utf8')

    expect(declaration).toContain('interface RuntimeOptions')
    expect(declaration).toContain('pageConfig')
    expect(declaration).not.toContain('mermaidContent')
  })
})
