import type { MermaidConfig } from 'mermaid'

export interface MermaidRun {
  source: string
  id: number
  theme: MermaidConfig['theme']
  securityLevel: MermaidConfig['securityLevel']
  unknownMermaidExtensionEnabled: boolean
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
