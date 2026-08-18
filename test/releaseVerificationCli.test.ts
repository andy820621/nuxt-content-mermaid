import { describe, expect, it, vi } from 'vitest'
import {
  parseVerificationSelection,
  runReleaseVerificationCli,
} from '../scripts/release-verification/package-artifact.mjs'
import { VERSION_PROFILES } from '../scripts/release-verification/profiles.mjs'

const artifact = {
  archivePath: '/tmp/package.tgz',
  filename: 'package.tgz',
  sha256: 'abc123',
  packlist: ['package.json'],
  packageName: '@barzhsieh/nuxt-content-mermaid',
  packageVersion: '2.2.3',
}

function createOperations() {
  return {
    createWorkspace: vi.fn(async () => ({
      root: '/tmp/workspace',
      artifactDirectory: '/tmp/workspace/artifact',
    })),
    createArtifact: vi.fn(async () => artifact),
    cleanupWorkspace: vi.fn(async () => undefined),
  }
}

describe('release verification CLI', () => {
  it('selects one profile and an optional retained artifact directory', () => {
    expect(parseVerificationSelection([
      '--profile',
      'v3-minimum',
      '--artifact-directory',
      '/tmp/release-artifact',
    ])).toEqual({
      artifactDirectory: '/tmp/release-artifact',
      profileId: 'v3-minimum',
    })

    expect(parseVerificationSelection([
      '--profile',
      'v3-minimum',
    ])).toEqual({
      profileId: 'v3-minimum',
    })
  })

  it.each([
    [[], 'Choose one Version Profile'],
    [['--profile'], 'Missing value for --profile'],
    [['--unknown', 'value'], 'Unknown option: --unknown'],
    [['--package-source', 'pack', '--profile', 'v3-minimum'], 'Unknown option: --package-source'],
    [['--artifact-directory', 'relative', '--profile', 'v3-minimum'], 'Artifact directory must be absolute'],
    [['--profile', 'v3-minimum', '--profile', 'v3-known-latest'], 'Duplicate option: --profile'],
  ])('rejects invalid arguments %#', (argv, message) => {
    expect(() => parseVerificationSelection(argv)).toThrow(message)
  })

  it('packs once in a managed directory and cleans it after verification', async () => {
    const operations = createOperations()
    const runner = vi.fn(async () => ({
      success: true,
      profile: { id: 'v3-minimum' },
    }))
    const writeEvidence = vi.fn()

    await runReleaseVerificationCli({
      argv: ['--profile', 'v3-minimum'],
      operations: operations as never,
      repositoryRoot: '/repo',
      runner: runner as never,
      writeEvidence,
    })

    expect(operations.createArtifact).toHaveBeenCalledOnce()
    expect(operations.createArtifact).toHaveBeenCalledWith({
      repositoryRoot: '/repo',
      artifactDirectory: '/tmp/workspace/artifact',
    })
    expect(runner).toHaveBeenCalledWith({
      artifact,
      profile: VERSION_PROFILES['v3-minimum'],
    }, operations)
    expect(operations.cleanupWorkspace).toHaveBeenCalledWith('/tmp/workspace')
    expect(writeEvidence).toHaveBeenCalledWith({
      success: true,
      profile: { id: 'v3-minimum' },
    })
  })

  it('packs once into an explicit directory and retains it for publishing', async () => {
    const operations = createOperations()
    const runner = vi.fn(async () => ({ success: true }))

    await runReleaseVerificationCli({
      argv: [
        '--profile', 'v3-minimum',
        '--artifact-directory', '/tmp/release-artifact',
      ],
      operations: operations as never,
      repositoryRoot: '/repo',
      runner: runner as never,
      writeEvidence: vi.fn(),
    })

    expect(operations.createWorkspace).not.toHaveBeenCalled()
    expect(operations.createArtifact).toHaveBeenCalledOnce()
    expect(operations.createArtifact).toHaveBeenCalledWith({
      repositoryRoot: '/repo',
      artifactDirectory: '/tmp/release-artifact',
    })
    expect(runner).toHaveBeenCalledWith({
      artifact,
      profile: VERSION_PROFILES['v3-minimum'],
    }, operations)
    expect(operations.cleanupWorkspace).not.toHaveBeenCalled()
  })

  it('cleans a managed directory when verification fails', async () => {
    const operations = createOperations()
    const failure = new Error('profile failed')

    await expect(runReleaseVerificationCli({
      argv: ['--profile', 'v3-minimum'],
      operations: operations as never,
      repositoryRoot: '/repo',
      runner: vi.fn(async () => { throw failure }) as never,
      writeEvidence: vi.fn(),
    })).rejects.toBe(failure)

    expect(operations.cleanupWorkspace).toHaveBeenCalledWith('/tmp/workspace')
  })
})
