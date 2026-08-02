import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

function readSnapshotState(html: string): {
  id: number
  before: string
  after: string
  frozen: string
} {
  const match = html.match(/<div id="runtime-snapshot">\s*(\d+)\|(\w+)\|(\w+)\|(\w+)\s*<\/div>/)
  if (!match) throw new Error(`Runtime snapshot state was not rendered: ${html}`)
  return {
    id: Number(match[1]),
    before: match[2] ?? '',
    after: match[3] ?? '',
    frozen: match[4] ?? '',
  }
}

describe('Runtime Mermaid Snapshot SSR ownership', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/runtime-snapshot', import.meta.url)),
  })

  it('creates a detached deeply frozen snapshot for every SSR render context', async () => {
    const first = readSnapshotState(await $fetch('/'))
    const second = readSnapshotState(await $fetch('/'))

    expect(first).toMatchObject({ before: 'neutral', after: 'neutral', frozen: 'true' })
    expect(second).toMatchObject({ before: 'neutral', after: 'neutral', frozen: 'true' })
    expect(second.id).not.toBe(first.id)
  })
})
