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

    expect(output).toContain('<Mermaid :config="config" code="graph%20TD%0A%20%20A%20--%3E%20B"></Mermaid>')
  })
})
