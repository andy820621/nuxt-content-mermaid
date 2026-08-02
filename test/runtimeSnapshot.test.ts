import { describe, expect, it } from 'vitest'
import { isProxy, reactive } from 'vue'
import {
  getRuntimeMermaidSnapshot,
  installRuntimeMermaidSnapshot,
} from '../src/runtime/runtime-snapshot'

function expectNoProxy(value: unknown): void {
  expect(isProxy(value)).toBe(false)
  if (value === null || typeof value !== 'object') return
  for (const nested of Object.values(value)) expectNoProxy(nested)
}

describe('app-scoped Runtime Mermaid Snapshot', () => {
  it('installs one isolated immutable snapshot on each app', () => {
    const firstApp = {}
    const secondApp = {}

    installRuntimeMermaidSnapshot(firstApp, { theme: { light: 'neutral' } })
    installRuntimeMermaidSnapshot(secondApp, { theme: { light: 'default' } })

    const firstSnapshot = getRuntimeMermaidSnapshot(firstApp)
    const secondSnapshot = getRuntimeMermaidSnapshot(secondApp)

    expect(firstSnapshot).not.toBe(secondSnapshot)
    expect(firstSnapshot.theme?.light).toBe('neutral')
    expect(secondSnapshot.theme?.light).toBe('default')

    installRuntimeMermaidSnapshot(firstApp, { theme: { light: 'forest' } })
    expect(getRuntimeMermaidSnapshot(firstApp)).toBe(firstSnapshot)
  })

  it('does not fall back to another app snapshot', () => {
    const installedApp = {}
    const missingApp = {}

    installRuntimeMermaidSnapshot(installedApp, {})

    expect(() => getRuntimeMermaidSnapshot(missingApp)).toThrow(
      'Runtime Mermaid Snapshot has not been installed for this NuxtApp',
    )
  })

  it('detaches Vue proxies without freezing or mutating the public payload', () => {
    const app = {}
    const payload = reactive({
      theme: { light: 'neutral' },
      loader: { init: { extension: { values: ['input'] } } },
    })

    installRuntimeMermaidSnapshot(app, payload)
    const snapshot = getRuntimeMermaidSnapshot(app)

    expectNoProxy(snapshot)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(payload)).toBe(false)
    expect(Object.isFrozen(payload.theme)).toBe(false)

    payload.theme.light = 'forest'
    ;(payload.loader.init.extension.values as string[]).push('changed')

    expect(snapshot.theme?.light).toBe('neutral')
    const extension = snapshot.loader?.init as { extension: { values: readonly string[] } }
    expect(extension.extension.values).toEqual(['input'])
  })

  it('publishes nothing when raw validation fails', () => {
    const app = {}

    expect(() => installRuntimeMermaidSnapshot(app, { enabled: true })).toThrowError(
      expect.objectContaining({ name: 'ContentMermaidConfigurationError' }),
    )
    expect(() => getRuntimeMermaidSnapshot(app)).toThrow(
      'Runtime Mermaid Snapshot has not been installed for this NuxtApp',
    )
  })
})
