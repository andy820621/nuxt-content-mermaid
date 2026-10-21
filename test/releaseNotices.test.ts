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
const RUNBOOK = 'docs/en/RELEASING.md'

function findPrereleaseNotices(files: Record<string, string>): string[] {
  const hits: string[] = []
  for (const [file, text] of Object.entries(files)) {
    for (const marker of PRERELEASE_MARKERS) {
      if (text.includes(marker)) hits.push(`${file}: ${marker}`)
    }
  }
  return hits
}

async function markdownFiles(root: string): Promise<string[]> {
  if (root.endsWith('.md')) return [root]
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => join(entry.parentPath, entry.name))
}

async function readTrackedDocs(): Promise<Record<string, string>> {
  const files = (await Promise.all(ROOTS.map(markdownFiles))).flat()
  return Object.fromEntries(await Promise.all(files.map(async file => [file, await readFile(file, 'utf8')])))
}

describe('prerelease notices', () => {
  it('flags a notice and ignores wording that only describes the release flow', () => {
    expect(findPrereleaseNotices({
      'docs/en/MIGRATION_V4.md': '> **Applies to the upcoming 4.x release (not yet published).**',
      'docs/en/RELEASING.md': 'For a major release, also remove the pre-release notices listed in test/releaseNotices.test.ts.',
    })).toEqual([
      'docs/en/MIGRATION_V4.md: not yet published',
      'docs/en/MIGRATION_V4.md: upcoming 4.x',
    ])
  })

  it('does not treat the release runbook itself as a notice', async () => {
    expect(findPrereleaseNotices({ [RUNBOOK]: await readFile(RUNBOOK, 'utf8') })).toEqual([])
  })

  it('exist while the package is still on the 3.x line and are gone once it declares 4.x', async () => {
    const { version } = JSON.parse(await readFile('package.json', 'utf8')) as { version: string }
    const major = Number(version.split('.')[0])
    const hits = findPrereleaseNotices(await readTrackedDocs())
    if (major >= 4) {
      expect(hits, `remove the pre-4.0 notices in the release PR (see ${RUNBOOK})`).toEqual([])
    }
    else {
      expect(hits.length).toBeGreaterThan(0)
    }
  })
})
