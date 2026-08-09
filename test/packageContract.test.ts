import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url))
const workspacePath = fileURLToPath(new URL('../pnpm-workspace.yaml', import.meta.url))

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

  it('declares the approved Nuxt 4-only Compatibility Contract', async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))

    expect(packageJson).toMatchObject({
      version: '2.2.3',
      engines: {
        node: '>=22.19.0',
      },
      peerDependencies: {
        '@nuxt/content': '>=3.5.0 <4.0.0',
        'nuxt': '^4.1.0',
      },
      dependencies: {
        '@nuxt/kit': 'catalog:integrations',
        'mermaid': 'catalog:integrations',
      },
      volta: {
        node: '24.19.0',
      },
    })
  })

  it('keeps the development catalogs on the Known-Latest Compatibility Profile', async () => {
    const workspace = parse(await readFile(workspacePath, 'utf8'))

    expect(workspace.catalogs).toMatchObject({
      dev: {
        nuxt: '4.5.2',
      },
      integrations: {
        '@nuxt/content': '3.15.2',
        '@nuxt/kit': '^4.5.2',
        '@nuxt/schema': '4.5.2',
        'mermaid': '~11.16.1',
      },
    })
  })
})
