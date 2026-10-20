import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Markers that only belong to the pre-4.0 "not yet published" notices.
const PRERELEASE_MARKERS = [
  'not yet published',
  '尚未發布',
  'Version scope:',
  '適用版本：',
  'This branch documents the upcoming',
  'upcoming 4.x',
  'upcoming v4',
  '即將推出',
]
const ROOTS = ['README.md', 'README.zh-TW.md', 'docs', 'website/content']

async function markdownFiles(root: string): Promise<string[]> {
  if (root.endsWith('.md')) return [root]
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => join(entry.parentPath, entry.name))
}

describe('prerelease notices', () => {
  it('exist while the package is still on the 3.x line and are gone once it declares 4.x', async () => {
    const { version } = JSON.parse(await readFile('package.json', 'utf8')) as { version: string }
    const major = Number(version.split('.')[0])
    const files = (await Promise.all(ROOTS.map(markdownFiles))).flat()
    const hits: string[] = []
    for (const file of files) {
      const text = await readFile(file, 'utf8')
      for (const marker of PRERELEASE_MARKERS) {
        if (text.includes(marker)) hits.push(`${file}: ${marker}`)
      }
    }
    if (major >= 4) {
      expect(hits, 'remove the pre-4.0 notices in the release PR (see docs/en/RELEASING.md)').toEqual([])
    }
    else {
      expect(hits.length).toBeGreaterThan(0)
    }
  })
})
