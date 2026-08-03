import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const mermaidEntryPath = fileURLToPath(new URL('../src/runtime/components/Mermaid.vue', import.meta.url))
const builtInRendererPath = fileURLToPath(new URL('../src/runtime/built-in-renderer/BuiltInRenderer.vue', import.meta.url))
const mermaidEntry = readFileSync(mermaidEntryPath, 'utf8')
const builtInRenderer = existsSync(builtInRendererPath)
  ? readFileSync(builtInRendererPath, 'utf8')
  : ''

describe('Built-in Renderer architecture ownership', () => {
  it('keeps Built-in rendering responsibilities in the internal deep module', () => {
    expect(mermaidEntry).toContain('from \'../built-in-renderer/BuiltInRenderer.vue\'')

    for (const responsibility of [
      'createMermaidRenderer',
      'materializeMermaidConfigForInvocation',
      'resolveMermaidTheme',
      'useMermaidTheme',
      'MermaidExpandOverlay',
      'MermaidFullscreenPresentation',
      '.mermaid-block',
    ]) {
      expect(mermaidEntry).not.toContain(responsibility)
      expect(builtInRenderer).toContain(responsibility)
    }
  })
})
