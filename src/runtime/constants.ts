import type { MermaidConfig } from 'mermaid'
import type { MermaidToolbarLabels, MermaidToolbarOptions } from '../types/mermaid'
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
export const TOOLBAR_LABEL_KEYS = [
  'copy',
  'copied',
  'copyFailed',
  'expand',
  'collapse',
  'minimize',
  'enterFullscreen',
  'exitFullscreen',
  'zoomIn',
  'zoomOut',
  'resetZoom',
  'download',
  'downloadSvg',
  'downloadPng',
] as const satisfies readonly (keyof MermaidToolbarLabels)[]
export const DEFAULT_TOOLBAR_LABELS = {
  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Copy failed',
  expand: 'Expand diagram',
  collapse: 'Collapse diagram',
  minimize: 'Minimize diagram',
  enterFullscreen: 'Enter fullscreen',
  exitFullscreen: 'Exit fullscreen',
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  resetZoom: 'Reset Zoom',
  download: 'Download diagram',
  downloadSvg: 'Download as SVG',
  downloadPng: 'Download as PNG',
} satisfies Required<MermaidToolbarLabels>
export const DEFAULT_TOOLBAR_OPTIONS: MermaidToolbarOptions = {
  title: 'mermaid',
  fontSize: '14px',
  fullscreenToolbarScale: 1.25,
  buttons: {
    copy: true,
    fullscreen: true,
    expand: true,
  },
  labels: DEFAULT_TOOLBAR_LABELS,
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

export const MERMAID_11_16_1_REGEXP_PATHS = [
  ['dompurifyConfig', 'ALLOWED_URI_REGEXP'],
  ['dompurifyConfig', 'CUSTOM_ELEMENT_HANDLING', 'attributeNameCheck'],
  ['dompurifyConfig', 'CUSTOM_ELEMENT_HANDLING', 'tagNameCheck'],
] as const

export const MERMAID_11_16_1_FUNCTION_CAPABILITY_PATHS = [
  ['sequence', 'actorFont'],
  ['sequence', 'messageFont'],
  ['sequence', 'noteFont'],
  ['c4', 'personFont'],
  ['c4', 'external_personFont'],
  ['c4', 'systemFont'],
  ['c4', 'external_systemFont'],
  ['c4', 'system_dbFont'],
  ['c4', 'external_system_dbFont'],
  ['c4', 'system_queueFont'],
  ['c4', 'external_system_queueFont'],
  ['c4', 'containerFont'],
  ['c4', 'external_containerFont'],
  ['c4', 'container_dbFont'],
  ['c4', 'external_container_dbFont'],
  ['c4', 'container_queueFont'],
  ['c4', 'external_container_queueFont'],
  ['c4', 'componentFont'],
  ['c4', 'external_componentFont'],
  ['c4', 'component_dbFont'],
  ['c4', 'external_component_dbFont'],
  ['c4', 'component_queueFont'],
  ['c4', 'external_component_queueFont'],
  ['c4', 'boundaryFont'],
  ['c4', 'messageFont'],
  ['dompurifyConfig', 'ADD_ATTR'],
  ['dompurifyConfig', 'ADD_TAGS'],
  ['dompurifyConfig', 'CUSTOM_ELEMENT_HANDLING', 'attributeNameCheck'],
  ['dompurifyConfig', 'CUSTOM_ELEMENT_HANDLING', 'tagNameCheck'],
] as const

export const DOMPURIFY_3_4_13_OPAQUE_CAPABILITY_PATHS = [
  ['dompurifyConfig', 'TRUSTED_TYPES_POLICY'],
] as const
