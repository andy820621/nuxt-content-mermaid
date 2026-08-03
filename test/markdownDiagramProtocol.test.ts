import { describe, expect, it } from 'vitest'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import type { MDCElement } from '@nuxtjs/mdc'
import { parse as parseYaml } from 'yaml'
import { transformMarkdownDiagrams } from '../src/markdown-diagram-transform'

async function parseProtocol(markdown: string) {
  const parsed = await parseMarkdown(transformMarkdownDiagrams(markdown), {
    highlight: false,
  })
  const component = parsed.body.children.find(
    (node): node is MDCElement => node.type === 'element' && node.tag.toLowerCase() === 'mermaid',
  )

  expect(component).toBeDefined()

  const props = (component?.props || {}) as Record<string, unknown>
  const source = decodeURIComponent(String(props.code || ''))
  const toolbar = props[':toolbar'] === undefined
    ? undefined
    : JSON.parse(String(props[':toolbar'])) as Record<string, unknown>

  return { parsed, component, props, source, toolbar }
}

function parseDiagramFrontmatter(source: string) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const startIndex = lines.findIndex(line => line.trim() === '---')
  const endIndex = lines.findIndex((line, index) => index > startIndex && line.trim() === '---')

  expect(startIndex).toBe(0)
  expect(endIndex).toBeGreaterThan(startIndex)

  return {
    data: parseYaml(lines.slice(startIndex + 1, endIndex).join('\n')) as Record<string, unknown>,
    diagramLines: lines.slice(endIndex + 1).map(line => line.trim()).filter(Boolean),
  }
}

describe('Markdown Diagram Protocol', () => {
  it('preserves normalized metadata semantics through the Nuxt Content MDC parser', async () => {
    const markdown = [
      '---',
      'config:',
      '  theme: neutral',
      '  flowchart:',
      '    curve: basis',
      '---',
      '# Diagram',
      '',
      '```mermaid {title="Inline Title" displayMode="compact" toolbar.fontSize="18px" config=\'{"theme":"forest"}\'}',
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

    const protocol = await parseProtocol(markdown)
    const diagram = parseDiagramFrontmatter(protocol.source)

    expect(protocol.component?.tag).toBe('mermaid')
    expect(protocol.props[':page-config']).toBe('config')
    expect(protocol.props).not.toHaveProperty(':config')
    expect(protocol.parsed.data.config).toEqual({
      theme: 'neutral',
      flowchart: {
        curve: 'basis',
      },
    })
    expect(protocol.toolbar).toEqual({
      title: 'YAML Toolbar',
      fontSize: '18px',
      buttons: {
        copy: false,
      },
    })
    expect(diagram.data).toEqual({
      title: 'Inline Title',
      displayMode: 'compact',
      toolbar: {
        title: 'YAML Toolbar',
        fontSize: '18px',
        buttons: {
          copy: false,
        },
      },
      config: {
        theme: 'forest',
        flowchart: {
          htmlLabels: false,
        },
      },
    })
    expect(diagram.diagramLines).toEqual([
      'graph TD',
      'A --> B',
    ])
  })

  it('preserves invalid Mermaid YAML Frontmatter as original Markdown', async () => {
    const markdown = [
      '```mermaid',
      '---',
      'title: [invalid',
      '---',
      'graph TD',
      '  A --> B',
      '```',
      '',
    ].join('\n')

    const parsed = await parseMarkdown(transformMarkdownDiagrams(markdown), { highlight: false })

    expect(parsed.body.children).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'element',
        tag: 'pre',
        props: expect.objectContaining({ code: expect.stringContaining('title: [invalid') }),
      }),
    ]))
    expect(parsed.body.children).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'element', tag: 'mermaid' }),
    ]))
  })
})
