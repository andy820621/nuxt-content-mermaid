import { describe, expect, it, vi } from 'vitest'
import {
  parseVerificationSelection,
  runReleaseVerificationCli,
} from '../scripts/release-verification/package-artifact.mjs'
import { VERSION_PROFILES } from '../scripts/release-verification/profiles.mjs'

describe('release verification CLI', () => {
  it('parses one profile without changing its input', () => {
    expect(parseVerificationSelection([
      '--package-source',
      'pack',
      '--profile',
      'v3-minimum',
    ])).toEqual({
      packageSource: 'pack',
      profileId: 'v3-minimum',
    })
  })

  it.each([
    [[], 'Choose one Version Profile'],
    [['--matrix', 'pinned'], 'Unknown option: --matrix'],
    [['--profile'], 'Missing value for --profile'],
    [['--unknown', 'value'], 'Unknown option: --unknown'],
  ])('rejects invalid arguments %#', (argv, message) => {
    expect(() => parseVerificationSelection(argv)).toThrow(message)
  })

  it('dispatches one selected profile to the single-profile runner', async () => {
    const single = vi.fn(async () => ({
      success: true,
      profile: { id: 'v3-minimum' },
    }))
    const writeEvidence = vi.fn()

    await runReleaseVerificationCli({
      argv: ['--profile', 'v3-minimum'],
      operations: {} as never,
      repositoryRoot: '/repo',
      runners: { single } as never,
      writeEvidence,
    })

    expect(single).toHaveBeenCalledWith({
      packageSource: {
        kind: 'pack',
        repositoryRoot: '/repo',
      },
      profile: VERSION_PROFILES['v3-minimum'],
    }, {})
    expect(writeEvidence).toHaveBeenCalledWith({
      success: true,
      profile: { id: 'v3-minimum' },
    })
  })

  it('propagates a runner failure to the process boundary', async () => {
    const failure = new Error('profile failed')

    await expect(runReleaseVerificationCli({
      argv: ['--profile', 'v3-minimum'],
      operations: {} as never,
      repositoryRoot: '/repo',
      runners: {
        single: vi.fn(async () => { throw failure }),
      } as never,
      writeEvidence: vi.fn(),
    })).rejects.toBe(failure)
  })
})
