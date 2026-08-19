import type { MermaidConfig } from 'mermaid'
import type { MermaidControl, MermaidTestWindow } from './types'

const pendingResolvers: Array<() => void> = []
const initializedConfigs = new WeakSet<object>()
let currentSecurityLevel: MermaidConfig['securityLevel']
let currentTheme: MermaidConfig['theme']
let currentUnknownMermaidExtensionEnabled = false
let currentDirectCapabilityFontSize: number | undefined
let currentDirectOpenValue: string | undefined
let currentDirectSharedReferencePreserved = false
const control: MermaidControl = {
  pending: 0,
  runs: [],
  stagingRoots: [],
  reusedInitializationConfig: false,
  releaseNext() {
    pendingResolvers.shift()?.()
  },
}

function createStrictSvg(id: number, source: string) {
  if (!source.includes('__UNSAFE__'))
    return `<svg data-run-id="${id}" data-source="${source}" width="600" height="400"></svg>`

  return `<svg data-run-id="${id}" data-source="${source}" width="600" height="400" onclick="alert(1)">
    <style>.safe { fill: url(#paint); }</style>
    <style>@import url("https://example.invalid/theme.css"); .unsafe { fill: red; }</style>
    <defs>
      <linearGradient id="paint"><stop offset="1" stop-color="red"></stop></linearGradient>
      <rect id="safe-shape" width="10" height="10"></rect>
    </defs>
    <a href="javascript:alert(1)" onclick="alert(1)"><text id="link-label">Link label</text></a>
    <rect id="safe-paint" width="20" height="20" fill="url(#paint)"></rect>
    <use id="safe-use" href="#safe-shape"></use>
    <use id="unsafe-use" href="data:image/svg+xml,unsafe"></use>
    <image id="external-image" href="https://example.invalid/image.svg"></image>
    <script>window.__unsafeSvgScript__ = true</script>
    <foreignObject>
      <div xmlns="http://www.w3.org/1999/xhtml" onclick="alert(1)">
        <strong>foreign content</strong>
      </div>
    </foreignObject>
    <iframe src="javascript:alert(1)"></iframe>
    <object data="data:text/html,unsafe"></object>
    <embed src="https://example.invalid/plugin"></embed>
  </svg>`
}

if (typeof window !== 'undefined')
  (window as MermaidTestWindow).__mermaidControl__ = control

const mermaidStub = {
  initialize: (config: MermaidConfig) => {
    if (initializedConfigs.has(config))
      control.reusedInitializationConfig = true
    initializedConfigs.add(config)
    currentSecurityLevel = config.securityLevel
    currentTheme = config.theme
    currentUnknownMermaidExtensionEnabled
      = (config as MermaidConfig & { unknownMermaidExtension?: { enabled?: boolean } })
        .unknownMermaidExtension?.enabled === true
    currentDirectCapabilityFontSize = config.sequence?.actorFont?.().fontSize as number | undefined
    const directExtension = (config as MermaidConfig & {
      directExtension?: {
        first?: { value?: string }
        second?: { value?: string }
      }
    }).directExtension
    currentDirectOpenValue = directExtension?.first?.value
    currentDirectSharedReferencePreserved
      = directExtension?.first !== undefined && directExtension.first === directExtension.second
  },
  render: async (_renderId: string, source: string, stagingTarget?: Element) => {
    const id = control.runs.length + 1
    const stagingRoot = stagingTarget?.parentElement
    if (stagingRoot)
      control.stagingRoots.push(stagingRoot)

    control.runs.push({
      source,
      id,
      theme: currentTheme,
      securityLevel: currentSecurityLevel,
      unknownMermaidExtensionEnabled: currentUnknownMermaidExtensionEnabled,
      directCapabilityFontSize: currentDirectCapabilityFontSize,
      directOpenValue: currentDirectOpenValue,
      directSharedReferencePreserved: currentDirectSharedReferencePreserved,
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
        : createStrictSvg(id, source),
    }
  },
}

export default mermaidStub
