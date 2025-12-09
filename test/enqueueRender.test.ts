import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enqueueRender } from '../src/runtime/utils'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('enqueueRender', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs tasks sequentially and logs when debug is enabled', async () => {
    const events: string[] = []
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await Promise.all([
      enqueueRender(async () => {
        events.push('first:start')
        await wait(5)
        events.push('first:end')
      }, true),
      enqueueRender(async () => {
        events.push('second')
      }, true),
    ])

    expect(events).toEqual(['first:start', 'first:end', 'second'])
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Enqueueing task'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Task finished'))
  })

  it('logs errors but keeps the queue progressing', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const events: string[] = []
    const boom = new Error('boom')

    await enqueueRender(async () => {
      throw boom
    }, true)

    await enqueueRender(async () => {
      events.push('after-error')
      logSpy('after-error-log')
    }, true)

    expect(errorSpy).toHaveBeenCalledWith('[nuxt-content-mermaid] Render error:', boom)
    expect(errorSpy).toHaveBeenCalledWith('[nuxt-content-mermaid] ❌ Queue chain caught error:', boom)
    expect(events).toEqual(['after-error'])
    expect(logSpy).toHaveBeenCalledWith('after-error-log')
  })
})
