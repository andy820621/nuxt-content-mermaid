import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { transformMermaidCodeBlocks } from '../src/module'

describe('transformMermaidCodeBlocks', () => {
  const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/transform')

  const loadFixture = (name: string) => {
    const url = resolve(fixtureDir, name)
    return readFileSync(url, 'utf-8')
  }

  const extractJsonProp = (output: string, prop: string) => {
    const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = output.match(new RegExp(`${escaped}='([^']+)'`))
    if (!match) return null
    return JSON.parse(match[1] || '{}') as Record<string, unknown>
  }

  const extractDecodedCode = (output: string) => {
    const match = output.match(/code="([^"]+)"/)
    if (!match) return ''
    return decodeURIComponent(match[1] || '')
  }

  const extractFrontmatter = (code: string) => {
    const normalized = code.replace(/\r\n/g, '\n')
    const match = normalized.match(/^[ \t]*---\n([\s\S]*?)\n[ \t]*---/)
    if (!match) return null
    const data = parseYaml(match[1] || '')
    return (data && typeof data === 'object') ? data as Record<string, unknown> : null
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

  it('transforms mermaid fences with info string attributes', () => {
    const body = [
      '# Diagram',
      '```mermaid {background:#ff0; border:2px solid #f00;}',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    const output = transformMermaidCodeBlocks(body, 'Mermaid')
    expect(output).toContain('<Mermaid :config="config" code="graph%20TD%0A%20%20A%20--%3E%20B"></Mermaid>')
  })

  it('extracts toolbar props from mermaid YAML frontmatter', () => {
    const body = [
      '```mermaid',
      '---',
      'toolbar:',
      '  title: Mermaid 1',
      '  fontSize: 24px',
      '---',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    const output = transformMermaidCodeBlocks(body, 'Mermaid')
    expect(extractJsonProp(output, ':toolbar')).toEqual({
      title: 'Mermaid 1',
      fontSize: '24px',
    })
  })

  it('falls back to raw code when mermaid YAML frontmatter is invalid', () => {
    const body = [
      '```mermaid',
      '---',
      'title: [invalid',
      '---',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    const output = transformMermaidCodeBlocks(body, 'Mermaid')
    const decoded = extractDecodedCode(output)

    expect(decoded).toBe([
      '---',
      'title: [invalid',
      '---',
      'graph TD',
      '  A --> B',
    ].join('\n'))
    expect(output).not.toContain(':toolbar=')
  })

  it('does not map YAML title to toolbar title', () => {
    const body = [
      '```mermaid',
      '---',
      'title: Sample Flowchart',
      'displayMode: compact',
      'config:',
      '  theme: dark',
      '---',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    const output = transformMermaidCodeBlocks(body, 'Mermaid')
    expect(output).not.toContain(':toolbar=')
  })

  it('ignores unsafe inline attrs like __proto__ in toolbar overrides', () => {
    const body = [
      '```mermaid {toolbar.__proto__="polluted" toolbar.title="Safe Title"}',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    const output = transformMermaidCodeBlocks(body, 'Mermaid')
    expect(extractJsonProp(output, ':toolbar')).toEqual({
      title: 'Safe Title',
    })
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined()
  })

  it('preserves numeric string fontSize in toolbar overrides', () => {
    const body = [
      '```mermaid {toolbar.fontSize="16"}',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    const output = transformMermaidCodeBlocks(body, 'Mermaid')
    expect(extractJsonProp(output, ':toolbar')).toEqual({
      fontSize: '16',
    })
  })

  it('merges YAML and inline props before passing to Mermaid', () => {
    const body = [
      '```mermaid {title="Inline Title" displayMode="compact" toolbar.fontSize="24px" config=\'{"theme":"forest","flowchart":{"curve":"step"}}\'}',
      '---',
      'title: YAML Title',
      'displayMode: standard',
      'toolbar:',
      '  title: YAML Toolbar',
      'config:',
      '  theme: dark',
      '  flowchart:',
      '    htmlLabels: false',
      '---',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    const output = transformMermaidCodeBlocks(body, 'Mermaid')

    expect(extractJsonProp(output, ':toolbar')).toEqual({
      title: 'YAML Toolbar',
      fontSize: '24px',
    })

    const frontmatter = extractFrontmatter(extractDecodedCode(output))
    expect(frontmatter).toEqual({
      title: 'Inline Title',
      displayMode: 'compact',
      toolbar: {
        title: 'YAML Toolbar',
        fontSize: '24px',
      },
      config: {
        theme: 'forest',
        flowchart: {
          curve: 'step',
          htmlLabels: false,
        },
      },
    })
  })

  it('moves frontmatter above mermaid directives before rendering', () => {
    const body = [
      '```mermaid {title="Mermaid 2" toolbar=\'{"title":"Inline","fontSize":"16px"}\' config=\'{"theme":"dark"}\'}',
      '%%{init: { "theme": "forest", "flowchart": { "curve": "step" } }}%%',
      '---',
      'title: Sample Flowchart',
      'displayMode: compact',
      'config:',
      '  theme: base',
      'toolbar:',
      '  title: Sample Diagram',
      '  fontSize: 24',
      '---',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    const output = transformMermaidCodeBlocks(body, 'Mermaid')
    const decoded = extractDecodedCode(output)

    expect(decoded.startsWith('---\n')).toBe(true)

    const frontmatter = extractFrontmatter(decoded)
    expect(frontmatter).toEqual({
      title: 'Mermaid 2',
      displayMode: 'compact',
      toolbar: {
        title: 'Inline',
        fontSize: '16px',
      },
      config: {
        theme: 'dark',
      },
    })

    const frontmatterBlock = decoded.match(/^[ \t]*---\n[\s\S]*?\n[ \t]*---/)
    expect(frontmatterBlock).not.toBeNull()
    const afterFrontmatter = decoded.slice(frontmatterBlock?.[0].length || 0)
    expect(afterFrontmatter).toContain('%%{init:')
  })

  it('preserves indentation when transforming mermaid fences', () => {
    const body = [
      '- Item',
      '  ```mermaid',
      '  graph TD',
      '  A --> B',
      '  ```',
      '',
    ].join('\n')

    const output = transformMermaidCodeBlocks(body, 'Mermaid')
    expect(output).toContain('  <Mermaid :config="config" code="graph%20TD%0A%20%20A%20--%3E%20B"></Mermaid>')
  })

  it('does not transform mermaid fences inside other fenced code blocks', () => {
    const body = [
      '````md',
      '# Diagram',
      '',
      '```mermaid',
      'graph TD',
      '  A --> B',
      '```',
      '````',
      '',
    ].join('\n')

    const output = transformMermaidCodeBlocks(body, 'Mermaid')
    expect(output).toBe(body)
  })

  it('does not transform mermaid fences inside ~~~ fenced code blocks', () => {
    const body = [
      '~~~md',
      '# Diagram',
      '',
      '```mermaid',
      'graph TD',
      '  A --> B',
      '```',
      '~~~',
      '',
    ].join('\n')

    const output = transformMermaidCodeBlocks(body, 'Mermaid')
    expect(output).toBe(body)
  })

  it('preserves CRLF newlines when transforming', () => {
    const body = [
      '```mermaid',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\r\n')

    const output = transformMermaidCodeBlocks(body, 'Mermaid')
    expect(output).toContain('graph%20TD%0D%0A%20%20A%20--%3E%20B')
    expect(output).not.toMatch(/(^|[^\r])\n/)
  })
})
