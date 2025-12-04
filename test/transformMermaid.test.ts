import { describe, it, expect } from 'vitest'
import { transformMermaidCodeBlocks } from '../src/module'

describe('transformMermaidCodeBlocks', () => {
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

    expect(output).toContain('<Mermaid :config="config">')
    expect(output).toContain('</Mermaid>')
  })
})
