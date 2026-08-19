import { defineEventHandler, setResponseHeader } from 'h3'

const css = `
@import url("/fixture-fonts.css");
#snapshot-host { --ncm-import-guard: local; }
`

export default defineEventHandler((event) => {
  setResponseHeader(event, 'content-type', 'text/css; charset=utf-8')
  return css
})
