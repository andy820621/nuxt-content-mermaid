import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'

const require = createRequire(import.meta.url)
const FONT_FILENAME = /^noto-sans-tc-(?:chinese-traditional|latin)-(?:400|700)-normal\.woff2$/

function fixtureCss() {
  return [400, 700].flatMap(weight => [
    `@font-face { font-family: "Noto Sans TC"; font-style: normal; font-display: block; font-weight: ${weight}; src: url("./files/noto-sans-tc-chinese-traditional-${weight}-normal.woff2") format("woff2"); unicode-range: U+3000-303F,U+3400-9FFF,U+F900-FAFF,U+FF00-FFEF; }`,
    `@font-face { font-family: "Noto Sans TC"; font-style: normal; font-display: block; font-weight: ${weight}; src: url("./files/noto-sans-tc-latin-${weight}-normal.woff2") format("woff2"); unicode-range: U+0000-024F,U+2000-206F; }`,
  ]).join('\n') + '\n#nuxt-content-mermaid-1, #nuxt-content-mermaid-1 * { font-family: "Noto Sans TC" !important; }'
}

export async function startFontFixtureServer(options: { cors: boolean }) {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
      if (options.cors) response.setHeader('access-control-allow-origin', '*')

      if (pathname === '/fixture-fonts.css') {
        response.setHeader('content-type', 'text/css; charset=utf-8')
        response.end(fixtureCss())
        return
      }

      const filename = pathname.startsWith('/files/')
        ? pathname.slice('/files/'.length)
        : ''
      if (FONT_FILENAME.test(filename)) {
        const path = require.resolve(`@fontsource/noto-sans-tc/files/${filename}`)
        response.setHeader('content-type', 'font/woff2')
        response.end(await readFile(path))
        return
      }

      response.writeHead(404).end()
    }
    catch (error) {
      response.writeHead(500).end(error instanceof Error ? error.message : String(error))
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address() as AddressInfo
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
    }),
  }
}
