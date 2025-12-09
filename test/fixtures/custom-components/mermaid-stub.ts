type InitCall = { theme?: string }
type RunCall = { source: string, threw: boolean }
type GlobalMermaidStub = typeof globalThis & {
  __forceMermaidError?: boolean
  __mermaidCalls__?: InitCall[]
  __mermaidRuns__?: RunCall[]
}

const calls: InitCall[] = []
const runs: RunCall[] = []

if (typeof window !== 'undefined') {
  const w = window as GlobalMermaidStub
  w.__mermaidCalls__ = calls
  w.__mermaidRuns__ = runs
}

const mermaidStub = {
  initialize: (config: Record<string, unknown>) => {
    calls.push(config)
  },
  run: async ({ nodes }: { nodes?: HTMLElement[] } = {}) => {
    await new Promise(resolve => setTimeout(resolve, 200))
    const container = nodes?.[0]
    if (!container) return

    const source = container.textContent || ''
    const shouldThrow = source.includes('__FORCE_ERROR__')
      || ((globalThis as GlobalMermaidStub).__forceMermaidError === true)
    runs.push({ source, threw: shouldThrow })

    if (shouldThrow) {
      throw new Error('Broken diagram')
    }

    container.innerHTML = '<svg id="mock-svg"></svg>'
  },
}

export default mermaidStub
