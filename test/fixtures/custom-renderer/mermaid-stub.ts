type TestWindow = Window & {
  __builtInMermaidRunCount__?: number
}

if (typeof window !== 'undefined')
  (window as TestWindow).__builtInMermaidRunCount__ = 0

const mermaidStub = {
  initialize: () => {},
  run: async () => {
    if (typeof window !== 'undefined')
      (window as TestWindow).__builtInMermaidRunCount__ = ((window as TestWindow).__builtInMermaidRunCount__ || 0) + 1
  },
}

export default mermaidStub
