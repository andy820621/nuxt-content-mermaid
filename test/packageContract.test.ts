import { describe, expect, it } from 'vitest'

describe('package root runtime contract', () => {
  it('exposes the Nuxt module without the legacy package-root transform export', async () => {
    const packageModule = await import('@barzhsieh/nuxt-content-mermaid')

    expect(packageModule.default).toBeDefined()
    expect('transformMermaidCodeBlocks' in packageModule).toBe(false)
  })
})
