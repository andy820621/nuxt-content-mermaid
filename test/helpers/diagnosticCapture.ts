import type { createPage } from '@nuxt/test-utils/e2e'

type BrowserPage = Awaited<ReturnType<typeof createPage>>

export type DiagnosticWindow = Window & {
  __mermaidDiagnosticEvents__?: string[]
}

export async function installDiagnosticCapture(page: BrowserPage) {
  await page.addInitScript(() => {
    const events: string[] = []
    ;(window as DiagnosticWindow).__mermaidDiagnosticEvents__ = events

    const capture = (args: unknown[]) => {
      const visited = new WeakSet<object>()
      const collectSemanticValues = (value: unknown) => {
        if (typeof value === 'string') {
          events.push(value)
          return
        }
        if (value === null || typeof value !== 'object' || visited.has(value)) return

        visited.add(value)
        for (const nested of Object.values(value))
          collectSemanticValues(nested)
      }

      for (const value of args) collectSemanticValues(value)
    }

    const originalLog = console.log.bind(console)
    console.log = (...args: unknown[]) => {
      capture(args)
      originalLog(...args)
    }

    const originalWarn = console.warn.bind(console)
    console.warn = (...args: unknown[]) => {
      capture(args)
      originalWarn(...args)
    }

    const originalError = console.error.bind(console)
    console.error = (...args: unknown[]) => {
      capture(args)
      originalError(...args)
    }
  })
}

export async function readDiagnosticEvents(page: BrowserPage) {
  return page.evaluate(() => {
    return (window as DiagnosticWindow).__mermaidDiagnosticEvents__ || []
  })
}
