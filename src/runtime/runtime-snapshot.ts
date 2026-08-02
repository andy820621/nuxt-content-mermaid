import {
  resolveRuntimeOptionsSnapshot,
  type ResolvedRuntimeOptions,
} from './configuration/runtime-options'

const runtimeMermaidSnapshotKey: unique symbol = Symbol('nuxt-content-mermaid:runtime-snapshot')

type RuntimeSnapshotApp = object & {
  readonly [runtimeMermaidSnapshotKey]?: ResolvedRuntimeOptions
}

export function installRuntimeMermaidSnapshot(
  nuxtApp: object,
  payload: unknown,
): ResolvedRuntimeOptions {
  const app = nuxtApp as RuntimeSnapshotApp
  const installed = app[runtimeMermaidSnapshotKey]
  if (installed) return installed

  const snapshot = resolveRuntimeOptionsSnapshot(payload)
  Object.defineProperty(app, runtimeMermaidSnapshotKey, {
    configurable: false,
    enumerable: false,
    value: snapshot,
    writable: false,
  })
  return snapshot
}

export function getRuntimeMermaidSnapshot(nuxtApp: object): ResolvedRuntimeOptions {
  const snapshot = (nuxtApp as RuntimeSnapshotApp)[runtimeMermaidSnapshotKey]
  if (!snapshot) {
    throw new Error(
      '[nuxt-content-mermaid] Runtime Mermaid Snapshot has not been installed for this NuxtApp',
    )
  }
  return snapshot
}
