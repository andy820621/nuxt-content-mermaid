import type { HtmlToImageControl, MermaidTestWindow } from './types'

const pendingResolvers: Array<() => void> = []
let nextError: Error | undefined

const control: HtmlToImageControl = {
  calls: 0,
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

export async function getFontEmbedCSS() {
  return ''
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
