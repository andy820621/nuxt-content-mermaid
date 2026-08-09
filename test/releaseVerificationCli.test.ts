import { describe, expect, it, vi } from 'vitest'
import {
  parseVerificationSelection,
  runReleaseVerificationCli,
} from '../scripts/release-verification/package-artifact.mjs'
import { VERSION_PROFILES } from '../scripts/release-verification/profiles.mjs'

describe('release verification CLI', () => {
  it('parses one profile or the pinned matrix without changing their inputs', () => {
    expect(parseVerificationSelection([
      '--package-source',
      'pack',
      '--profile',
      'nuxt-3-minimum',
    ])).toEqual({
      packageSource: 'pack',
      profileId: 'nuxt-3-minimum',
    })
    expect(parseVerificationSelection([
      '--package-source=pack',
      '--matrix=pinned',
    ])).toEqual({
      packageSource: 'pack',
      matrixId: 'pinned',
    })
  })

  it.each([
    [[], 'Choose either one Version Profile or one matrix'],
    [['--profile', 'nuxt-3-minimum', '--matrix', 'pinned'], 'Choose either one Version Profile or one matrix'],
    [['--profile'], 'Missing value for --profile'],
    [['--unknown', 'value'], 'Unknown option: --unknown'],
  ])('rejects invalid arguments %#', (argv, message) => {
    expect(() => parseVerificationSelection(argv)).toThrow(message)
  })

  it('dispatches one selected profile to the single-profile runner', async () => {
    const single = vi.fn(async () => ({
      success: true,
      profile: { id: 'nuxt-3-minimum' },
    }))
    const matrix = vi.fn()
    const writeEvidence = vi.fn()

    await runReleaseVerificationCli({
      argv: ['--profile', 'nuxt-3-minimum'],
      operations: {} as never,
      repositoryRoot: '/repo',
      runners: { single, matrix } as never,
      writeEvidence,
    })

    expect(single).toHaveBeenCalledWith({
      packageSource: {
        kind: 'pack',
        repositoryRoot: '/repo',
      },
      profile: VERSION_PROFILES['nuxt-3-minimum'],
    }, {})
    expect(matrix).not.toHaveBeenCalled()
    expect(writeEvidence).toHaveBeenCalledWith({
      success: true,
      profile: { id: 'nuxt-3-minimum' },
    })
  })

  it('dispatches all pinned profiles to the matrix runner', async () => {
    const single = vi.fn()
    const matrix = vi.fn(async request => ({
      success: true,
      profileIds: request.profiles.map((profile: { id: string }) => profile.id),
    }))
    const writeEvidence = vi.fn()

    await runReleaseVerificationCli({
      argv: ['--matrix', 'pinned'],
      operations: {} as never,
      repositoryRoot: '/repo',
      runners: { single, matrix } as never,
      writeEvidence,
    })

    expect(single).not.toHaveBeenCalled()
    expect(matrix).toHaveBeenCalledOnce()
    expect(matrix.mock.calls[0]![0].profiles.map((profile: { id: string }) => profile.id))
      .toEqual([
        'nuxt-3-minimum',
        'nuxt-4-minimum',
        'nuxt-3-known-latest',
        'nuxt-4-known-latest',
        'nuxt-3-minimum-content-known-latest',
        'nuxt-4-known-latest-content-minimum',
      ])
    expect(writeEvidence).toHaveBeenCalledWith({
      success: true,
      profileIds: expect.any(Array),
    })
  })

  it('propagates a runner failure to the process boundary', async () => {
    const failure = new Error('profile failed')

    await expect(runReleaseVerificationCli({
      argv: ['--matrix', 'pinned'],
      operations: {} as never,
      repositoryRoot: '/repo',
      runners: {
        single: vi.fn(),
        matrix: vi.fn(async () => { throw failure }),
      } as never,
      writeEvidence: vi.fn(),
    })).rejects.toBe(failure)
  })
})
