import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const lockfilePath = fileURLToPath(new URL('../pnpm-lock.yaml', import.meta.url))

describe('workspace dependency resolution', () => {
  // A second unhead 3 copy can be the one a fresh install hoists to node_modules/unhead.
  // Nitro then inlines Nuxt's copy and emits an unresolvable unhead/dist/minify.mjs import,
  // so every server-rendered Documentation Website route returns HTTP 500.
  it('resolves one unhead 3 release for Nuxt and every module', async () => {
    const lockfile = parse(await readFile(lockfilePath, 'utf8'))
    const unheadReleases = Object.keys(lockfile.packages).filter(key => key.startsWith('unhead@3.'))

    expect(unheadReleases).toHaveLength(1)
  })
})
