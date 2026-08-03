import type { MermaidConfig } from 'mermaid'

type LazyMermaidWindow = Window & {
  __lazyMermaidControl__?: {
    runs: string[]
    pending: number
    releaseNext: () => void
  }
}

const pendingResolvers: Array<() => void> = []
const control = {
  runs: [] as string[],
  pending: 0,
  releaseNext() {
    pendingResolvers.shift()?.()
  },
}

if (typeof window !== 'undefined')
  (window as LazyMermaidWindow).__lazyMermaidControl__ = control

export default {
  initialize: (_config: MermaidConfig) => {},
  render: async (_renderId: string, source: string) => {
    control.runs.push(source)
    control.pending++
    await new Promise<void>(resolve => pendingResolvers.push(resolve))
    control.pending--

    if (source.includes('__FAIL__'))
      throw new Error('Broken recovery diagram')

    return {
      diagramType: 'flowchart',
      svg: `<svg data-source="${source}" width="600" height="400"></svg>`,
    }
  },
}
