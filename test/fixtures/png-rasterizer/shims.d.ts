declare module '*.svg?raw' {
  const source: string
  export default source
}

declare function useRuntimeConfig(event: import('h3').H3Event): {
  fontFixtureRoot: string
}
