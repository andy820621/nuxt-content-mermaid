// test/fixtures/color-mode/mermaid-stub.ts
export interface MermaidInitConfig {
  theme?: string
  [key: string]: unknown
}

const calls: MermaidInitConfig[] = []

declare global {
  interface Window {
    __mermaidInitCalls__?: MermaidInitConfig[]
    __mockMermaidLoaded__?: boolean
  }
}

if (typeof window !== 'undefined') {
  window.__mermaidInitCalls__ = calls
  window.__mockMermaidLoaded__ = true
}

const mermaidStub = {
  initialize: (config: MermaidInitConfig) => {
    calls.push(config)
  },
  run: async () => {},
}

export default mermaidStub
