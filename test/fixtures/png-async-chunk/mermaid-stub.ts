const mermaidStub = {
  initialize() {},
  async render(id: string) {
    return {
      diagramType: 'flowchart',
      svg: `<svg id="${id}" width="320" height="180" viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="20" width="280" height="140" fill="#dbeafe"></rect>
        <foreignObject x="40" y="55" width="240" height="70">
          <div xmlns="http://www.w3.org/1999/xhtml"><strong>Production PNG chunk</strong></div>
        </foreignObject>
      </svg>`,
    }
  },
}

export default mermaidStub
