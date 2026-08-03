import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const mermaidEntryPath = fileURLToPath(new URL('../src/runtime/components/Mermaid.vue', import.meta.url))
const mermaidEntry = readFileSync(mermaidEntryPath, 'utf8')

describe('Renderer Selection orchestration', () => {
  it('checks attempt currency before handling a settled outcome', () => {
    const watcherStart = mermaidEntry.indexOf('let latestRendererSelectionRequestId')
    const watcherEnd = mermaidEntry.indexOf('{ immediate: true },', watcherStart)
    expect(watcherStart).toBeGreaterThanOrEqual(0)
    expect(watcherEnd).toBeGreaterThan(watcherStart)

    const watcher = mermaidEntry.slice(watcherStart, watcherEnd)
    const attemptMatch = /const\s+(\w+)\s*=\s*\+\+(\w+)/.exec(watcher)
    const resolutionMatch = /const\s+(\w+)\s*=\s*await\s+\w+\.resolution/.exec(watcher)
    expect(attemptMatch).not.toBeNull()
    expect(resolutionMatch).not.toBeNull()

    const [, attempt, currentAttempt] = attemptMatch || []
    const [, settledOutcome] = resolutionMatch || []
    const guardMatch = new RegExp(
      `if\\s*\\(\\s*${attempt}\\s*!==\\s*${currentAttempt}\\s*\\)\\s*return`,
    ).exec(watcher)
    const settledHandling = new RegExp(
      `if\\s*\\(\\s*${settledOutcome}\\.status`,
    ).exec(watcher)

    expect(guardMatch).not.toBeNull()
    expect(settledHandling).not.toBeNull()
    expect(guardMatch?.index).toBeGreaterThan(resolutionMatch?.index ?? -1)
    expect(settledHandling?.index).toBeGreaterThan(guardMatch?.index ?? -1)
  })
})
