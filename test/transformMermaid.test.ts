import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { transformMermaidCodeBlocks } from '../src/module'

describe('transformMermaidCodeBlocks', () => {
  const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/transform')

  const loadFixture = (name: string) => {
    const url = resolve(fixtureDir, name)
    return readFileSync(url, 'utf-8')
  }

  it('wraps mermaid code blocks with Mermaid component and config binding', () => {
    const body = [
      '# Diagram',
      '```mermaid',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    const output = transformMermaidCodeBlocks(body, 'Mermaid')

    expect(output).toContain('<Mermaid :config="config" code="graph%20TD%0A%20%20A%20--%3E%20B"></Mermaid>')
  })

  it('transforms multiple mermaid blocks in a single document', () => {
    const body = loadFixture('multiple-blocks.md')
    const output = transformMermaidCodeBlocks(body, 'Mermaid')

    const matches = output.match(/<Mermaid :config="config" code="/g) || []
    expect(matches.length).toBe(2)
    expect(output).toContain('graph%20TD%0A%20%20A%5BStart%5D%20--%3E%20B%7BChoice%7D')
    expect(output).toContain('sequenceDiagram%0A%20%20participant%20Alice')
  })

  it('leaves empty mermaid blocks untouched', () => {
    const body = [
      '```mermaid',
      '   ',
      '```',
    ].join('\n')

    const output = transformMermaidCodeBlocks(body, 'Mermaid')
    expect(output).toBe(body)
  })
})
