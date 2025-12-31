import type { MermaidConfig } from 'mermaid'
import type { MermaidToolbarOptions } from '../types/mermaid'
import type { ExpandOptions } from './types/expand'

export const DEFAULT_LIGHT_THEME: MermaidConfig['theme'] = 'default'
export const DEFAULT_DARK_THEME: MermaidConfig['theme'] = 'dark'
export const DEFAULT_MERMAID_CONFIG: MermaidConfig = {
  startOnLoad: false,
  theme: 'default',
  fontFamily: 'Arial, sans-serif, 微軟正黑體',
  securityLevel: 'strict',
  logLevel: 'error',
}
export const DEFAULT_TOOLBAR_OPTIONS: MermaidToolbarOptions = {
  title: 'mermaid',
  fontSize: '14px',
  fullscreenToolbarScale: 1.25,
  buttons: {
    copy: true,
    fullscreen: true,
    expand: true,
  },
}
export const DEFAULT_EXPAND_OPTIONS: ExpandOptions = {
  enabled: true,
  margin: 0,
  invokeOpenOn: {
    diagramClick: true,
  },
  invokeCloseOn: {
    esc: true,
    wheel: true,
    swipe: true,
    overlayClick: true,
    closeButtonClick: true,
  },
}

export const DEFAULT_FRONTMATTER_CONFIG_KEY = 'config'
