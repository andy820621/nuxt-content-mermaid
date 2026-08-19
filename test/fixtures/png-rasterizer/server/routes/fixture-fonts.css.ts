import { defineEventHandler, setResponseHeader } from 'h3'

const weights = [400, 700]

const css = weights.flatMap(weight => [
  `@font-face { font-family: "Noto Sans TC"; font-style: normal; font-display: block; font-weight: ${weight}; src: url("/files/noto-sans-tc-chinese-traditional-${weight}-normal.woff2") format("woff2"); unicode-range: U+3000-303F,U+3400-9FFF,U+F900-FAFF,U+FF00-FFEF; }`,
  `@font-face { font-family: "Noto Sans TC"; font-style: normal; font-display: block; font-weight: ${weight}; src: url("/files/noto-sans-tc-latin-${weight}-normal.woff2") format("woff2"); unicode-range: U+0000-024F,U+2000-206F; }`,
]).join('\n') + `
#nuxt-content-mermaid-1, #nuxt-content-mermaid-1 * { font-family: "Noto Sans TC" !important; }
#snapshot-host { --ncm-import-guard: imported; }
`

export default defineEventHandler((event) => {
  setResponseHeader(event, 'content-type', 'text/css; charset=utf-8')
  return css
})
