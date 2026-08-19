import contentMermaidModule, { type ModuleOptions } from '@barzhsieh/nuxt-content-mermaid'
import type { NuxtConfig, NuxtModule } from '@nuxt/schema'

const options = {
  enabled: true,
  toolbar: {
    title: 'Diagram',
    labels: {
      copy: 'Copy source',
      copied: 'Source copied',
      copyFailed: 'Copy failed',
      expand: 'Expand diagram',
      collapse: 'Collapse diagram',
      minimize: 'Minimize diagram',
      enterFullscreen: 'Enter fullscreen',
      exitFullscreen: 'Exit fullscreen',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      resetZoom: 'Reset zoom',
      download: 'Download diagram',
      downloadSvg: 'Download as SVG',
      downloadPng: 'Download as PNG',
    },
    buttons: {
      copy: true,
    },
  },
} satisfies ModuleOptions

const moduleDefinition: NuxtModule<ModuleOptions> = contentMermaidModule
const nuxtConfig: NuxtConfig = { contentMermaid: options }

void moduleDefinition
void nuxtConfig
