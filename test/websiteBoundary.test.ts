import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

type WorkspaceConfiguration = {
  packages?: string[]
  linkWorkspacePackages?: boolean
  preferWorkspacePackages?: boolean
}

type WebsiteManifest = {
  private?: boolean
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

describe('documentation website application boundary', () => {
  it('installs an exact stable artifact in an isolated private workspace', async () => {
    const workspace = parse(await readFile('pnpm-workspace.yaml', 'utf8')) as WorkspaceConfiguration
    const website = JSON.parse(await readFile('website/package.json', 'utf8')) as WebsiteManifest

    expect(workspace.packages).toContain('website')
    expect(workspace.linkWorkspacePackages).toBe(false)
    expect(workspace.preferWorkspacePackages).toBe(false)
    expect(website).toMatchObject({
      private: true,
      scripts: {
        typecheck: 'nuxt prepare && vue-tsc --noEmit -p tsconfig.json',
        generate: 'nuxt generate',
      },
      dependencies: {
        '@barzhsieh/nuxt-content-mermaid': '3.0.0',
        '@nuxt/content': 'catalog:integrations',
        'better-sqlite3': '12.5.0',
        'nuxt': 'catalog:dev',
      },
      devDependencies: {
        'typescript': 'catalog:dev',
        'vue-tsc': 'catalog:dev',
      },
    })
  })

  it('owns its content collection and public route queries without root or playground authority', async () => {
    const [
      contentConfig,
      homePage,
      gettingStartedPage,
      troubleshootingPage,
      migrationPage,
      referencePage,
      pageShell,
      nuxtConfig,
    ] = await Promise.all([
      readFile('website/content.config.ts', 'utf8'),
      readFile('website/pages/index.vue', 'utf8'),
      readFile('website/pages/getting-started.vue', 'utf8'),
      readFile('website/pages/troubleshooting.vue', 'utf8'),
      readFile('website/pages/migration/v3.vue', 'utf8'),
      readFile('website/pages/reference.vue', 'utf8'),
      readFile('website/components/PageShell.vue', 'utf8'),
      readFile('website/nuxt.config.ts', 'utf8'),
    ])

    expect(contentConfig).toContain('pages: defineCollection({')
    expect(contentConfig).toContain('source: \'**/*.md\'')
    expect(contentConfig).toMatch(/pageId: z\.enum\(\[[^\]]*'troubleshooting'[^\]]*'migration-v3'[^\]]*'reference'[^\]]*\]\)/)
    expect(contentConfig).not.toMatch(/(?:\.\.\/)+(?:content\.config|playground)|from ['"].*playground/)

    expect(homePage).toMatch(/queryCollection\('pages'\)\.path\('\/'\)\.first\(\)/)
    expect(gettingStartedPage).toMatch(/queryCollection\('pages'\)\.path\('\/getting-started'\)\.first\(\)/)
    expect(troubleshootingPage).toMatch(/queryCollection\('pages'\)\.path\('\/troubleshooting'\)\.first\(\)/)
    expect(migrationPage).toMatch(/queryCollection\('pages'\)\.path\('\/migration\/v3'\)\.first\(\)/)
    expect(referencePage).toMatch(/queryCollection\('pages'\)\.path\('\/reference'\)\.first\(\)/)
    expect(nuxtConfig).toContain('loadWebsiteReferencePublicModel')
    expect(nuxtConfig).toMatch(/appConfig:\s*\{[^}]*websiteReference/)
    expect(referencePage).toContain('useAppConfig()')
    expect(referencePage).not.toContain('loadWebsiteReferencePublicModel')
    expect(referencePage).not.toContain('import.meta.server')
    expect(referencePage).not.toMatch(/records\.v1\.json|\$fetch|\bfetch\s*\(/)
    expect(pageShell).toContain('to="/reference"')
    expect(pageShell).toContain('Reference')
    expect(nuxtConfig).toMatch(/routes:\s*\[[^\]]*'\/troubleshooting'[^\]]*'\/migration\/v3'[^\]]*'\/reference'[^\]]*\]/)

    for (const routeSource of [homePage, gettingStartedPage, troubleshootingPage, migrationPage, referencePage]) {
      expect(routeSource).not.toMatch(/queryCollection\('(?!pages')[^']+'\)|from ['"].*(?:content\.config|playground)/)
    }
  })
})
