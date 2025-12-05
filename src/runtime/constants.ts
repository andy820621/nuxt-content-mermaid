import type { MermaidConfig } from 'mermaid'

export const DEFAULT_LIGHT_THEME: MermaidConfig['theme'] = 'default'
export const DEFAULT_DARK_THEME: MermaidConfig['theme'] = 'dark'
export const DEFAULT_MERMAID_CONFIG: MermaidConfig = {
  startOnLoad: false,
  theme: 'default',
  fontFamily: 'Arial, sans-serif, 微軟正黑體',
  securityLevel: 'strict',
  logLevel: 'error',
}

export const DEFAULT_FRONTMATTER_CONFIG_KEY = 'config'
