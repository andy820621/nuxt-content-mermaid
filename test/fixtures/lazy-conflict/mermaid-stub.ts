import type { MermaidConfig } from 'mermaid'

type LazyMermaidWindow = Window & {
  __lazyMermaidControl__?: {
    runs: string[]
  }
}

const control = { runs: [] as string[] }

if (typeof window !== 'undefined')
  (window as LazyMermaidWindow).__lazyMermaidControl__ = control

export default {
  initialize: (_config: MermaidConfig) => {},
  render: async (_renderId: string, source: string) => {
    control.runs.push(source)
    return {
      diagramType: 'flowchart',
      svg: `<svg data-source="${source}" width="600" height="400"></svg>`,
    }
  },
}
