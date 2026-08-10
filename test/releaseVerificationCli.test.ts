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

  it('requires an explicit archive and checksum in artifact mode', () => {
    expect(parseVerificationSelection([
      '--package-source',
      'artifact',
      '--archive',
      '/tmp/package.tgz',
      '--checksum',
      '/tmp/artifact.sha512',
      '--profile',
      'v3-minimum',
    ])).toEqual({
      packageSource: 'artifact',
      archivePath: '/tmp/package.tgz',
      checksumPath: '/tmp/artifact.sha512',
      profileId: 'v3-minimum',
    })
  })

  it.each([
    [[], 'Choose one Version Profile'],
    [['--matrix', 'pinned'], 'Unknown option: --matrix'],
    [['--profile'], 'Missing value for --profile'],
    [['--unknown', 'value'], 'Unknown option: --unknown'],
    [['--package-source', 'artifact', '--profile', 'v3-minimum'], 'requires --archive and --checksum'],
    [['--archive', '/tmp/package.tgz', '--profile', 'v3-minimum'], 'only valid with artifact'],
  ])('rejects invalid arguments %#', (argv, message) => {
    expect(() => parseVerificationSelection(argv)).toThrow(message)
  })

  it('dispatches one selected profile to the single-profile runner', async () => {
    const single = vi.fn(async () => ({
      success: true,
      profile: { id: 'v3-minimum' },
    }))
    const writeEvidence = vi.fn()

    const artifact = {
      archivePath: '/tmp/package.tgz',
      filename: 'package.tgz',
      sha256: 'abc123',
      integritySha512: 'sha512-Zml4dHVyZQ==',
      packlist: ['package.json'],
      packageName: '@barzhsieh/nuxt-content-mermaid',
      packageVersion: '2.2.3',
    }
    const operations = {
      createWorkspace: vi.fn(async () => ({
        root: '/tmp/workspace',
        artifactDirectory: '/tmp/workspace/artifact',
      })),
      createArtifact: vi.fn(async () => artifact),
      cleanupWorkspace: vi.fn(async () => undefined),
    }

    await runReleaseVerificationCli({
      argv: ['--profile', 'v3-minimum'],
      operations: operations as never,
      repositoryRoot: '/repo',
      runners: { single } as never,
      writeEvidence,
    })

    expect(single).toHaveBeenCalledWith({
      packageSource: {
        kind: 'artifact',
        artifact,
      },
      profile: VERSION_PROFILES['v3-minimum'],
    }, operations)
    expect(operations.createArtifact).toHaveBeenCalledOnce()
    expect(operations.cleanupWorkspace).toHaveBeenCalledWith('/tmp/workspace')
    expect(writeEvidence).toHaveBeenCalledWith({
      success: true,
      profile: { id: 'v3-minimum' },
    })
  })

  it('loads artifact mode without creating or packing an archive', async () => {
    const artifact = { packageName: 'package', packageVersion: '2.2.3' }
    const single = vi.fn(async () => ({ success: true }))
    const operations = {
      loadArtifact: vi.fn(async () => artifact),
      createArtifact: vi.fn(),
    }

    await runReleaseVerificationCli({
      argv: [
        '--package-source', 'artifact',
        '--archive', '/tmp/package.tgz',
        '--checksum', '/tmp/artifact.sha512',
        '--profile', 'v3-minimum',
      ],
      operations: operations as never,
      repositoryRoot: '/repo',
      runners: { single } as never,
      writeEvidence: vi.fn(),
    })

    expect(operations.loadArtifact).toHaveBeenCalledWith({
      archivePath: '/tmp/package.tgz',
      checksumPath: '/tmp/artifact.sha512',
    })
    expect(operations.createArtifact).not.toHaveBeenCalled()
    expect(single).toHaveBeenCalledWith({
      packageSource: { kind: 'artifact', artifact },
      profile: VERSION_PROFILES['v3-minimum'],
    }, operations)
  })

  it('propagates a runner failure to the process boundary', async () => {
    const failure = new Error('profile failed')
    const artifact = { packageName: 'package', packageVersion: '2.2.3' }

    await expect(runReleaseVerificationCli({
      argv: [
        '--package-source', 'artifact',
        '--archive', '/tmp/package.tgz',
        '--checksum', '/tmp/artifact.sha512',
        '--profile', 'v3-minimum',
      ],
      operations: {
        loadArtifact: vi.fn(async () => artifact),
      } as never,
      repositoryRoot: '/repo',
      runners: {
        single: vi.fn(async () => { throw failure }),
      } as never,
      writeEvidence: vi.fn(),
    })).rejects.toBe(failure)
  })
})
