import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const dependabotConfigPath = fileURLToPath(
  new URL('../.github/dependabot.yml', import.meta.url),
)

describe('proportional dependency update configuration', () => {
  it('creates limited weekly candidates without expanding the public contract', async () => {
    const config = parse(await readFile(dependabotConfigPath, 'utf8'))

    expect(config).toMatchObject({
      version: 2,
      updates: [{
        'package-ecosystem': 'npm',
        'directory': '/',
        'schedule': { interval: 'weekly' },
        'open-pull-requests-limit': 3,
        'versioning-strategy': 'increase-if-necessary',
        'assignees': ['andy820621'],
        'allow': [
          { 'dependency-name': 'nuxt' },
          { 'dependency-name': '@nuxt/kit' },
          { 'dependency-name': '@nuxt/schema' },
          { 'dependency-name': '@nuxt/content' },
          { 'dependency-name': 'mermaid' },
        ],
        'groups': {
          'nuxt-toolchain': {
            patterns: ['nuxt', '@nuxt/kit', '@nuxt/schema'],
          },
          'nuxt-content': {
            patterns: ['@nuxt/content'],
          },
          'mermaid': {
            patterns: ['mermaid'],
          },
        },
      }],
    })

    expect(config.updates[0].ignore).toEqual(expect.arrayContaining([
      { 'dependency-name': 'nuxt', 'update-types': ['version-update:semver-major'] },
      { 'dependency-name': '@nuxt/content', 'update-types': ['version-update:semver-major'] },
      { 'dependency-name': '@nuxt/kit', 'update-types': ['version-update:semver-major'] },
      { 'dependency-name': '@nuxt/schema', 'update-types': ['version-update:semver-major'] },
      { 'dependency-name': 'mermaid', 'update-types': ['version-update:semver-major'] },
    ]))
  })
})
