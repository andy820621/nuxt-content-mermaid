import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function readDocument(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
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
})
