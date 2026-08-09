import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const dependabotConfigPath = fileURLToPath(
  new URL('../.github/dependabot.yml', import.meta.url),
)

describe('Dependabot security update configuration', () => {
  it('keeps security PRs enabled while disabling unreliable version PRs', async () => {
    const config = parse(await readFile(dependabotConfigPath, 'utf8'))

    expect(config).toEqual({
      version: 2,
      updates: [{
        'package-ecosystem': 'npm',
        'directory': '/',
        'schedule': { interval: 'weekly' },
        'open-pull-requests-limit': 0,
        'assignees': ['andy820621'],
      }],
    })
  })
})
