import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  createError,
  defineEventHandler,
  getRouterParam,
  setResponseHeader,
} from 'h3'

const FONT_FILENAME = /^noto-sans-tc-(?:chinese-traditional|latin)-(?:400|700)-normal\.woff2$/

export default defineEventHandler(async (event) => {
  const filename = getRouterParam(event, 'font') ?? ''
  if (!FONT_FILENAME.test(filename)) {
    throw createError({ statusCode: 404 })
  }

  const config = useRuntimeConfig(event)
  setResponseHeader(event, 'content-type', 'font/woff2')
  return readFile(resolve(config.fontFixtureRoot, filename))
})
