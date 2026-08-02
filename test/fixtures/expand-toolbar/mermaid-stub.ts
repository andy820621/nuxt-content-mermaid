type RunCall = { source: string }
type GlobalMermaidStub = typeof globalThis & {
  __mermaidRuns__?: RunCall[]
}

const runs: RunCall[] = []

if (typeof window !== 'undefined') {
  const w = window as GlobalMermaidStub
  w.__mermaidRuns__ = runs
}

const mermaidStub = {
  initialize: () => {},
  render: async (_renderId: string, source: string) => {
    runs.push({ source })

    const id = source.includes('SECONDARY') ? 'mock-svg-secondary' : 'mock-svg'
    return {
      diagramType: 'flowchart',
      svg: `<svg id="${id}" width="600" height="400"></svg>`,
    }
  },
}

export default mermaidStub
