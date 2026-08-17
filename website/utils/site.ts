export const SITE_ORIGIN = 'https://nuxt-content-mermaid.barz.app'

export const PUBLIC_ROUTES = [
  '/',
  '/getting-started',
  '/writing-diagrams',
  '/configuration',
  '/troubleshooting',
  '/migration/v3',
  '/zh',
  '/zh/getting-started',
  '/zh/writing-diagrams',
  '/zh/configuration',
  '/zh/troubleshooting',
  '/zh/migration/v3',
] as const

export function toSiteURL(path: string) {
  return new URL(path, SITE_ORIGIN).href
}
