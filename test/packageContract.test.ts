import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url))

describe('package root runtime contract', () => {
  it('exposes the Nuxt module without the legacy package-root transform export', async () => {
    const packageModule = await import('@barzhsieh/nuxt-content-mermaid')

    expect(
      'default' in packageModule ? packageModule.default : undefined,
    ).toBeDefined()
    expect('transformMermaidCodeBlocks' in packageModule).toBe(false)
    expect('ContentMermaidConfigurationError' in packageModule).toBe(false)
    expect('ConfigurationIssue' in packageModule).toBe(false)
  })

  it('publishes the explicitly verified Nuxt and Nuxt Content peer ranges', async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))

    expect(packageJson.peerDependencies).toMatchObject({
      '@nuxt/content': '>=3.5.0 <4.0.0',
      'nuxt': '^3.20.1 || ^4.1.0',
    })
  })
})
