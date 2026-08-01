export interface MermaidControl {
  pending: number
  runs: Array<{ source: string, id: number }>
  lastError?: Error
  releaseNext: () => void
}

export type MermaidTestWindow = Window & {
  __mermaidControl__?: MermaidControl
}
