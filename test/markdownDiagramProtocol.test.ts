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
  const match = source.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  expect(match).not.toBeNull()

  return {
    data: parseYaml(match?.[1] || '') as Record<string, unknown>,
    diagram: match?.[2] || '',
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
    expect(protocol.props[':config']).toBe('config')
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
    expect(diagram.diagram).toBe([
      'graph TD',
      '  A --> B',
    ].join('\n'))
  })

  it('preserves invalid Mermaid YAML Frontmatter as a local fallback', async () => {
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

    const protocol = await parseProtocol(markdown)

    expect(protocol.source).toBe([
      '---',
      'title: [invalid',
      '---',
      'graph TD',
      '  A --> B',
    ].join('\n'))
    expect(protocol.props[':config']).toBe('config')
    expect(protocol.props).not.toHaveProperty(':toolbar')
  })
})
