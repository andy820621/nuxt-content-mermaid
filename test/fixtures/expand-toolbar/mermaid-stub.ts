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
  run: async ({ nodes }: { nodes?: HTMLElement[] } = {}) => {
    const container = nodes?.[0]
    if (!container) return

    const source = container.textContent || ''
    runs.push({ source })

    const id = source.includes('SECONDARY') ? 'mock-svg-secondary' : 'mock-svg'
    container.innerHTML = `<svg id="${id}" width="600" height="400"></svg>`
  },
}

export default mermaidStub
