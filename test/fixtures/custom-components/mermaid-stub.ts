type InitCall = { theme?: string }
type RunCall = { source: string, threw: boolean }
type GlobalMermaidStub = typeof globalThis & {
  __forceMermaidError?: boolean
  __holdMermaidRender__?: boolean
  __releaseMermaidRender__?: () => void
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
  render: async (_renderId: string, source: string) => {
    const globalState = globalThis as GlobalMermaidStub
    if (globalState.__holdMermaidRender__) {
      await new Promise<void>((resolve) => {
        globalState.__releaseMermaidRender__ = () => {
          globalState.__holdMermaidRender__ = false
          delete globalState.__releaseMermaidRender__
          resolve()
        }
      })
    }
    else {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    const shouldThrow = source.includes('__FORCE_ERROR__')
      || (globalState.__forceMermaidError === true)
    runs.push({ source, threw: shouldThrow })

    if (shouldThrow) {
      throw new Error('Broken diagram')
    }

    return {
      diagramType: 'flowchart',
      svg: '<svg id="mock-svg"></svg>',
    }
  },
}

export default mermaidStub
