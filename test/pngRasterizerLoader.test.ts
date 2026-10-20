import { describe, expect, it, vi } from 'vitest'
import type { rasterizePngSnapshot } from '../src/runtime/png-rasterizer'
import { createPngRasterizerLoader } from '../src/runtime/png-rasterizer-loader'

describe('PNG rasterizer loader', () => {
  it('retries after rejection and shares pending and successful loads', async () => {
    const failure = new Error('chunk unavailable')
    const rasterizer = { rasterizePngSnapshot: vi.fn<typeof rasterizePngSnapshot>() }
    const importer = vi.fn<() => Promise<typeof rasterizer>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue(rasterizer)
    const load = createPngRasterizerLoader(importer)

    const firstAttempt = load()
    expect(load()).toBe(firstAttempt)
    await expect(firstAttempt).rejects.toBe(failure)

    const retry = load()
    expect(load()).toBe(retry)
    await expect(retry).resolves.toBe(rasterizer)
    expect(load()).toBe(retry)
    expect(importer).toHaveBeenCalledTimes(2)
  })

  it('keeps the load cache local to each component instance', async () => {
    const rasterizer = { rasterizePngSnapshot: vi.fn<typeof rasterizePngSnapshot>() }
    const importer = vi.fn(async () => rasterizer)
    const first = createPngRasterizerLoader(importer)
    const second = createPngRasterizerLoader(importer)

    await Promise.all([first(), first(), second()])
    expect(importer).toHaveBeenCalledTimes(2)
  })
})
