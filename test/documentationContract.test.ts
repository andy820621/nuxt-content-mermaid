import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function readDocument(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function sectionBetween(
  documentName: string,
  document: string,
  startHeading: string,
  endHeading: string,
): string {
  const start = document.indexOf(startHeading)
  if (start === -1) {
    throw new Error(`${documentName}: missing section heading ${startHeading}`)
  }

  const end = document.indexOf(endHeading, start + startHeading.length)
  if (end === -1) {
    throw new Error(`${documentName}: missing section boundary ${endHeading}`)
  }

  return document.slice(start, end)
}

function vueExamples(documentName: string, section: string): string {
  const examples = [...section.matchAll(/^[ \t]*```vue[ \t]*\r?\n([\s\S]*?)^[ \t]*```[ \t]*$/gm)]
    .map(match => match.at(1) ?? '')

  if (examples.length === 0) {
    throw new Error(`${documentName}: custom renderer section must keep a Vue example`)
  }

  return examples.join('\n')
}

const readmes = {
  'README.md': readDocument('../README.md'),
  'README.zh-TW.md': readDocument('../README.zh-TW.md'),
}

const manualThemeGuides = {
  'docs/en/MANUAL_THEME_CONTROL.md': readDocument('../docs/en/MANUAL_THEME_CONTROL.md'),
  'docs/ch/MANUAL_THEME_CONTROL.md': readDocument('../docs/ch/MANUAL_THEME_CONTROL.md'),
}

describe('public documentation executable examples', () => {
  it('does not assign explicit undefined in public configuration examples', () => {
    for (const [documentName, document] of Object.entries(readmes)) {
      expect(
        document,
        `${documentName}: omit unset configuration properties instead of assigning explicit undefined`,
      ).not.toMatch(/^[ \t]*[$A-Z_a-z][$\w]*[ \t]*:[ \t]*undefined,?[ \t]*$/m)
    }
  })

  it('does not import useMermaidTheme from the package root', () => {
    const rootImport
      = /import\s*\{[^}]*\buseMermaidTheme\b[^}]*\}\s*from\s*['"]@barzhsieh\/nuxt-content-mermaid['"]/

    for (const [documentName, document] of Object.entries(manualThemeGuides)) {
      expect(
        document,
        `${documentName}: useMermaidTheme is a Nuxt auto-import and is not exported from the package root`,
      ).not.toMatch(rootImport)
    }
  })

  it('does not render Mermaid inside configured custom renderer examples', () => {
    const customRendererSections = {
      'README.md': sectionBetween(
        'README.md',
        readmes['README.md'],
        '### Custom Rendering Component',
        '### Wrapper Example',
      ),
      'README.zh-TW.md': sectionBetween(
        'README.zh-TW.md',
        readmes['README.zh-TW.md'],
        '### 自訂渲染元件 (Custom Component)',
        '### 元件使用方式',
      ),
    }

    for (const [documentName, section] of Object.entries(customRendererSections)) {
      expect(
        vueExamples(documentName, section),
        `${documentName}: a configured custom renderer must render directly instead of nesting <Mermaid>`,
      ).not.toMatch(/<Mermaid(?:\s|>)/)
    }
  })
})
