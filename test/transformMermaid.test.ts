import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import type { MDCElement } from '@nuxtjs/mdc'
import { transformMarkdownDiagrams } from '../src/markdown-diagram-transform'
import {
  resolveFenceInlineAttributes,
  resolveMarkdownFrontmatter,
  resolveMarkdownToolbar,
} from '../src/markdown-diagram-transform/configuration'

describe('transformMarkdownDiagrams', () => {
  const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/transform')

  const loadFixture = (name: string) => {
    const url = resolve(fixtureDir, name)
    return readFileSync(url, 'utf-8')
  }

  const extractToolbarProp = async (output: string) => {
    const parsed = await parseMarkdown(output, { highlight: false })
    const component = parsed.body.children.find(
      (node): node is MDCElement => node.type === 'element' && node.tag.toLowerCase() === 'content-mermaid-transport',
    )
    const toolbar = component?.props?.[':toolbar']

    return typeof toolbar === 'string'
      ? JSON.parse(toolbar) as Record<string, unknown>
      : null
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

  it('uses the Markdown page-config transport when frontmatter has no config', () => {
    const body = [
      '# Diagram',
      '```mermaid',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    const output = transformMarkdownDiagrams(body)

    expect(output).toContain('<ContentMermaidTransport :page-config="config" code="graph%20TD%0A%20%20A%20--%3E%20B"></ContentMermaidTransport>')
    expect(output).not.toContain('<Mermaid')
    expect(output).not.toContain(':config="config"')
  })

  it.each([
    { label: 'a leading blank line', prefix: '' },
    { label: 'a leading Mermaid comment', prefix: '%% page comment' },
  ])('keeps page config on the Markdown transport after $label', ({ prefix }) => {
    const body = [
      prefix,
      '---',
      'config:',
      '  theme: dark',
      '---',
      '```mermaid',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    const output = transformMarkdownDiagrams(body)
    expect(output).toContain('<ContentMermaidTransport :page-config="config" code="')
    expect(output).not.toContain('<Mermaid')
  })

  it('transforms multiple mermaid blocks in a single document', () => {
    const body = loadFixture('multiple-blocks.md')
    const output = transformMarkdownDiagrams(body)

    const matches = output.match(/<ContentMermaidTransport :page-config="config" code="/g) || []
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

    const output = transformMarkdownDiagrams(body)
    expect(output).toBe(body)
  })

  it('preserves supported empty inline attribute syntax', () => {
    const body = [
      '```mermaid {}',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    const output = transformMarkdownDiagrams(body)
    expect(output).toContain('<ContentMermaidTransport :page-config="config" code="')
  })

  it('preserves non-target Markdown exactly', () => {
    const body = [
      '# Document',
      '',
      'Text with `inline code` and trailing spaces.  ',
      '',
      '```typescript',
      'const diagram = "mermaid"',
      '```',
      '',
    ].join('\n')

    expect(transformMarkdownDiagrams(body)).toBe(body)
  })

  it('does not recognize language names that only start with mermaid', () => {
    const body = [
      '```mermaidjs',
      'graph TD',
      '  A --> B',
      '```',
    ].join('\n')

    expect(transformMarkdownDiagrams(body)).toBe(body)
  })

  it('leaves unclosed mermaid fences untouched', () => {
    const body = [
      '# Diagram',
      '```mermaid',
      'graph TD',
      '  A --> B',
    ].join('\n')

    expect(transformMarkdownDiagrams(body)).toBe(body)
  })

  it('matches closing fences by marker character and minimum length', () => {
    const body = [
      '````mermaid',
      'graph TD',
      '```',
      '  A --> B',
      '~~~~',
      '  B --> C',
      '`````',
    ].join('\n')

    const output = transformMarkdownDiagrams(body)

    expect(extractDecodedCode(output)).toBe([
      'graph TD',
      '```',
      '  A --> B',
      '~~~~',
      '  B --> C',
    ].join('\n'))
  })

  it('propagates unexpected transformation failures', () => {
    const body = [
      '```mermaid',
      '\uD800',
      '```',
    ].join('\n')

    expect(() => transformMarkdownDiagrams(body)).toThrow()
  })

  it('returns the original fence for unsupported info string attributes', () => {
    const body = [
      '# Diagram',
      '```mermaid {background:#ff0; border:2px solid #f00;}',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    expect(transformMarkdownDiagrams(body)).toBe(body)
  })

  it('extracts toolbar props from mermaid YAML frontmatter', async () => {
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

    const output = transformMarkdownDiagrams(body)
    expect(await extractToolbarProp(output)).toEqual({
      title: 'Mermaid 1',
      fontSize: '24px',
    })
  })

  it('keeps fullscreenToolbarScale from YAML toolbar config', async () => {
    const body = [
      '```mermaid',
      '---',
      'toolbar:',
      '  title: Mermaid 2',
      '  fullscreenToolbarScale: 1.5',
      '---',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    const output = transformMarkdownDiagrams(body)
    expect(await extractToolbarProp(output)).toEqual({
      title: 'Mermaid 2',
      fullscreenToolbarScale: 1.5,
    })
  })

  it('returns the original fence when mermaid YAML frontmatter is invalid', () => {
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

    const output = transformMarkdownDiagrams(body)

    expect(output).toBe(body)
    expect(output).not.toContain('<Mermaid')
  })

  it('does not map YAML title to toolbar title', async () => {
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

    const output = transformMarkdownDiagrams(body)
    expect(await extractToolbarProp(output)).toBeNull()
  })

  it('returns the original fence for unsafe inline attribute paths', () => {
    const body = [
      '```mermaid {toolbar.__proto__="polluted" toolbar.title="Safe Title"}',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    const output = transformMarkdownDiagrams(body)
    expect(output).toBe(body)
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined()
  })

  it('preserves numeric string fontSize in toolbar overrides', async () => {
    const body = [
      '```mermaid {toolbar.fontSize="16"}',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    const output = transformMarkdownDiagrams(body)
    expect(await extractToolbarProp(output)).toEqual({
      fontSize: '16',
    })
  })

  it('merges YAML and inline props before passing to Mermaid', async () => {
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

    const output = transformMarkdownDiagrams(body)

    expect(await extractToolbarProp(output)).toEqual({
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

  it('returns the original fence instead of partially transforming unsafe metadata', () => {
    const body = [
      '```mermaid {title="Inline Title" displayMode="compact" toolbar.fontSize="18px" toolbar.constructor.polluted=true config=\'{"theme":"forest"}\'}',
      '---',
      'title: YAML Title',
      'displayMode: standard',
      'toolbar:',
      '  title: YAML Toolbar',
      '  buttons:',
      '    copy: false',
      'config:',
      '  flowchart:',
      '    htmlLabels: false',
      '---',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    expect(transformMarkdownDiagrams(body)).toBe(body)
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

    const output = transformMarkdownDiagrams(body)
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

    const output = transformMarkdownDiagrams(body)
    expect(output).toContain('  <ContentMermaidTransport :page-config="config" code="graph%20TD%0A%20%20A%20--%3E%20B"></ContentMermaidTransport>')
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

    const output = transformMarkdownDiagrams(body)
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

    const output = transformMarkdownDiagrams(body)
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

    const output = transformMarkdownDiagrams(body)
    expect(output).toContain('graph%20TD%0D%0A%20%20A%20--%3E%20B')
    expect(output).not.toMatch(/(^|[^\r])\n/)
  })

  it('preserves open Markdown and Mermaid configuration keys with property-presence precedence', () => {
    const body = [
      '```mermaid {config=\'{"extension":{"array":["inline"],"enabled":false,"limit":0,"label":""}}\'}',
      '---',
      'unknownMarkdownKey: retained',
      'config:',
      '  unknownMermaidKey:',
      '    preserved: true',
      '  extension:',
      '    array: [yaml]',
      '    enabled: true',
      '    limit: 1',
      '    label: YAML',
      '---',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    expect(extractFrontmatter(extractDecodedCode(transformMarkdownDiagrams(body)))).toEqual({
      unknownMarkdownKey: 'retained',
      config: {
        unknownMermaidKey: { preserved: true },
        extension: {
          array: ['inline'],
          enabled: false,
          limit: 0,
          label: '',
        },
      },
    })
  })

  it.each([
    ['unknown inline attributes', ['```mermaid {unknown=true}']],
    ['unknown toolbar keys', ['```mermaid', '---', 'toolbar:', '  unsupported: true', '---']],
    ['null toolbar values', ['```mermaid', '---', 'toolbar: null', '---']],
  ])('returns the original fence for %s', (_name, openingLines) => {
    const body = [
      ...openingLines,
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    expect(transformMarkdownDiagrams(body)).toBe(body)
  })

  it('rejects accessor metadata without invoking it', () => {
    let reads = 0
    const inlineAttrs = Object.defineProperty({}, 'title', {
      enumerable: true,
      get() {
        reads += 1
        return 'never read'
      },
    })

    expect(resolveFenceInlineAttributes(inlineAttrs)).toBeNull()
    expect(reads).toBe(0)
  })

  it('exposes separate normalized Markdown metadata resolvers', () => {
    const frontmatter = resolveMarkdownFrontmatter([
      { config: { extension: { array: ['yaml'], enabled: true } } },
      { config: { extension: { array: ['inline'], enabled: false } } },
    ])

    expect(frontmatter).toEqual({
      config: { extension: { array: ['inline'], enabled: false } },
    })
    expect(resolveMarkdownToolbar([
      { title: 'YAML Toolbar' },
      { fontSize: '18px' },
    ])).toEqual({
      title: 'YAML Toolbar',
      fontSize: '18px',
    })
  })
})
