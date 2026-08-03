declare global {
  interface Window {
    __customRendererResolution__?: {
      readonly pending: true
      readonly resolve: () => void
    }
  }
}

if (import.meta.client) {
  await new Promise<void>((resolve) => {
    window.__customRendererResolution__ = {
      pending: true,
      resolve,
    }
  })
}

export {}
