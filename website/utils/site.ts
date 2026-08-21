export const SITE_NAME = 'Nuxt Content Mermaid'

export const SITE_ORIGIN = 'https://nuxt-content-mermaid.barz.app'

export const SITE_DESCRIPTION = 'Turn Mermaid code blocks into interactive diagrams without leaving your Markdown workflow.'

export const PUBLIC_ROUTES = [
  '/',
  '/getting-started',
  '/writing-diagrams',
  '/configuration',
  '/advanced/themes-and-styling',
  '/advanced/custom-rendering',
  '/advanced/interactions',
  '/troubleshooting',
  '/migration/v3',
  '/zh',
  '/zh/getting-started',
  '/zh/writing-diagrams',
  '/zh/configuration',
  '/zh/advanced/themes-and-styling',
  '/zh/advanced/custom-rendering',
  '/zh/advanced/interactions',
  '/zh/troubleshooting',
  '/zh/migration/v3',
] as const

export function toSiteURL(path: string) {
  return new URL(path, SITE_ORIGIN).href
}
