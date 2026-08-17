import { defineEventHandler, setResponseHeader } from 'h3'
import { PUBLIC_ROUTES, toSiteURL } from '../../utils/site'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')

  const urls = PUBLIC_ROUTES
    .map(path => `  <url><loc>${toSiteURL(path)}</loc></url>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
})
