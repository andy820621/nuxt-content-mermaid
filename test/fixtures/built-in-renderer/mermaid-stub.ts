import type { MermaidControl, MermaidTestWindow } from './types'

const pendingResolvers: Array<() => void> = []
const control: MermaidControl = {
  pending: 0,
  runs: [],
  releaseNext() {
    pendingResolvers.shift()?.()
  },
}

if (typeof window !== 'undefined')
  (window as MermaidTestWindow).__mermaidControl__ = control

const mermaidStub = {
  initialize: () => {},
  run: async ({ nodes }: { nodes?: HTMLElement[] } = {}) => {
    const target = nodes?.[0]
    if (!target) return

    const source = target.textContent || ''
    const id = control.runs.length + 1
    control.runs.push({ source, id })
    control.pending++
    await new Promise<void>(resolve => pendingResolvers.push(resolve))
    control.pending--

    if (source.includes('__FAIL__')) {
      const error = new Error('Broken diagram')
      control.lastError = error
      throw error
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('data-run-id', String(id))
    svg.setAttribute('data-source', source)
    svg.setAttribute('width', '600')
    svg.setAttribute('height', '400')
    target.replaceChildren(svg)
  },
}

export default mermaidStub
