import type { MermaidConfig } from 'mermaid'
import type { MermaidControl, MermaidTestWindow } from './types'

const pendingResolvers: Array<() => void> = []
const initializedConfigs = new WeakSet<object>()
let currentSecurityLevel: MermaidConfig['securityLevel']
const control: MermaidControl = {
  pending: 0,
  runs: [],
  stagingRoots: [],
  reusedInitializationConfig: false,
  releaseNext() {
    pendingResolvers.shift()?.()
  },
}

if (typeof window !== 'undefined')
  (window as MermaidTestWindow).__mermaidControl__ = control

const mermaidStub = {
  initialize: (config: MermaidConfig) => {
    if (initializedConfigs.has(config))
      control.reusedInitializationConfig = true
    initializedConfigs.add(config)
    currentSecurityLevel = config.securityLevel
  },
  render: async (_renderId: string, source: string, stagingTarget?: Element) => {
    const id = control.runs.length + 1
    const stagingRoot = stagingTarget?.parentElement
    if (stagingRoot)
      control.stagingRoots.push(stagingRoot)

    control.runs.push({
      source,
      id,
      securityLevel: currentSecurityLevel,
      stagingConnected: stagingTarget?.isConnected === true,
      stagingHidden: stagingRoot?.getAttribute('aria-hidden') === 'true',
      stagingInert: stagingRoot?.inert === true && stagingRoot.style.pointerEvents === 'none',
      stagingOutsideLiveSubtree: stagingTarget?.closest('.mermaid') === null,
    })
    control.pending++
    await new Promise<void>(resolve => pendingResolvers.push(resolve))
    control.pending--

    if (source.includes('__FAIL__')) {
      const error = new Error('Broken diagram')
      control.lastError = error
      throw error
    }

    return {
      diagramType: 'flowchart',
      svg: currentSecurityLevel === 'sandbox'
        ? `<iframe data-run-id="${id}" data-source="${source}"></iframe>`
        : `<svg data-run-id="${id}" data-source="${source}" width="600" height="400"></svg>`,
    }
  },
}

export default mermaidStub
