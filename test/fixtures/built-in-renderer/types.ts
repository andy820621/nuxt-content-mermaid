import type { MermaidConfig } from 'mermaid'

export interface MermaidRun {
  source: string
  id: number
  securityLevel: MermaidConfig['securityLevel']
  stagingConnected: boolean
  stagingHidden: boolean
  stagingInert: boolean
  stagingOutsideLiveSubtree: boolean
}

export interface MermaidControl {
  pending: number
  runs: MermaidRun[]
  stagingRoots: HTMLElement[]
  reusedInitializationConfig: boolean
  lastError?: Error
  releaseNext: () => void
}

export type MermaidTestWindow = Window & {
  __mermaidControl__?: MermaidControl
}
