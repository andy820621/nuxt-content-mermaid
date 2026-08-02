import type { MermaidConfig } from 'mermaid'
import type { MermaidToolbarOptions } from '../types/mermaid'
import type { RuntimeMermaidConfig, RuntimeOptions } from '../types/config'
import type { ExpandOptions } from './types/expand'

export const MERMAID_LOG_PREFIX = '[nuxt-content-mermaid]'
export const PAGE_MERMAID_CONFIG_PHASE = {
  name: 'Page Mermaid Config',
  root: 'pageConfig',
} as const
export const DEFAULT_LIGHT_THEME: MermaidConfig['theme'] = 'default'
export const DEFAULT_DARK_THEME: MermaidConfig['theme'] = 'dark'
export const FULLSCREEN_ZOOM_HINT_DURATION_MS = 3000
export const DEFAULT_MERMAID_CONFIG: MermaidConfig = {
  startOnLoad: false,
  theme: 'default',
  fontFamily: 'Arial, sans-serif, 微軟正黑體',
  securityLevel: 'strict',
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

export const DEFAULT_RUNTIME_OPTIONS = {
  debug: false,
  loader: {
    init: DEFAULT_MERMAID_CONFIG as RuntimeMermaidConfig,
    lazy: true,
  },
  theme: {
    light: DEFAULT_LIGHT_THEME,
    dark: DEFAULT_DARK_THEME,
  },
  components: {},
  expand: DEFAULT_EXPAND_OPTIONS,
  toolbar: DEFAULT_TOOLBAR_OPTIONS,
} satisfies RuntimeOptions

export const DEFAULT_FRONTMATTER_CONFIG_KEY = 'config'
