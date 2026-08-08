import contentMermaidModule, { type ModuleOptions } from '@barzhsieh/nuxt-content-mermaid'
import type { NuxtConfig, NuxtModule } from '@nuxt/schema'

const options = {
  enabled: true,
  toolbar: {
    title: 'Diagram',
    buttons: {
      copy: true,
    },
  },
} satisfies ModuleOptions

const moduleDefinition: NuxtModule<ModuleOptions> = contentMermaidModule
const nuxtConfig: NuxtConfig = { contentMermaid: options }

void moduleDefinition
void nuxtConfig
