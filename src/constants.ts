import type { MermaidConfig } from 'mermaid'

export const DEFAULT_IMPORT_SOURCE
  = 'https://cdn.jsdelivr.net/npm/mermaid@11.12.1/dist/mermaid.esm.min.mjs'
export const DEFAULT_LIGHT_THEME: MermaidConfig['theme'] = 'default'
export const DEFAULT_DARK_THEME: MermaidConfig['theme'] = 'dark'
export const DEFAULT_MERMAID_INIT: MermaidConfig = {
  startOnLoad: false,
}
