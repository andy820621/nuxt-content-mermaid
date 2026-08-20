import type { HtmlToImageControl, MermaidTestWindow } from './types'

const pendingResolvers: Array<() => void> = []
let nextError: Error | undefined

const control: HtmlToImageControl = {
  calls: 0,
  fontFamilies: [],
  fontSources: [],
  pending: 0,
  failNext(message) {
    nextError = new Error(message)
  },
  releaseNext() {
    pendingResolvers.shift()?.()
  },
}

const testWindow = window as MermaidTestWindow
testWindow.__htmlToImageModuleEvaluations__
  = (testWindow.__htmlToImageModuleEvaluations__ ?? 0) + 1
testWindow.__htmlToImageControl__ = control

export async function getFontEmbedCSS(node: HTMLElement) {
  const fontFaceRules = Array.from(node.ownerDocument.styleSheets).flatMap((stylesheet) => {
    try {
      return Array.from(stylesheet.cssRules)
        .filter((rule): rule is CSSFontFaceRule => rule.type === CSSRule.FONT_FACE_RULE)
    }
    catch {
      return []
    }
  })
  control.fontFamilies = fontFaceRules.map(rule =>
    rule.style.getPropertyValue('font-family').replace(/^['"]|['"]$/g, ''),
  )
  control.fontSources = fontFaceRules.map(rule => rule.style.getPropertyValue('src'))
  return fontFaceRules.map(rule => rule.cssText)
    .join('\n')
    .replace(/url\([^)]*\)/g, 'url(data:font/woff2;base64,AA==)')
}

export async function toBlob() {
  control.calls++
  control.pending++
  await new Promise<void>(resolve => pendingResolvers.push(resolve))
  control.pending--

  if (nextError) {
    const error = nextError
    nextError = undefined
    throw error
  }

  return new Blob(['png'], { type: 'image/png' })
}
