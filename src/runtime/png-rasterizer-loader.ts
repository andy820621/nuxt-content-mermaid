type PngRasterizerModule = typeof import('./png-rasterizer')

export function createPngRasterizerLoader(importModule: () => Promise<PngRasterizerModule>) {
  let modulePromise: Promise<PngRasterizerModule> | undefined

  return () => modulePromise ??= importModule().catch((error) => {
    modulePromise = undefined
    throw error
  })
}
