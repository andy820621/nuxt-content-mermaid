import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  ReleaseVerificationFailure,
  runPackageArtifactVerification,
} from '../scripts/release-verification/runner.mjs'
import type { PackageArtifactVerificationRequest } from '../scripts/release-verification/runner.mjs'

const knownLatestProfile = {
  id: 'nuxt-4-known-latest',
  versions: {
    betterSqlite3: '12.11.1',
    nuxt: '4.5.2',
    nuxtContent: '3.15.2',
    mermaid: '11.12.3',
    typescript: '5.9.3',
    vueTsc: '3.2.5',
  },
}

function createOperations() {
  const workspace = {
    root: '/tmp/package-artifact-verification',
    artifactDirectory: '/tmp/package-artifact-verification/artifact',
    archiveDirectory: '/tmp/package-artifact-verification/archive',
    consumerDirectory: '/tmp/package-artifact-verification/consumer',
  }
  const archivePath = join(workspace.artifactDirectory, 'barzhsieh-nuxt-content-mermaid-2.2.3.tgz')
  const artifact = {
    archivePath,
    filename: 'barzhsieh-nuxt-content-mermaid-2.2.3.tgz',
    sha256: 'abc123',
    packageName: '@barzhsieh/nuxt-content-mermaid',
    packageVersion: '2.2.3',
  }

  return {
    workspace,
    artifact,
    operations: {
      createWorkspace: vi.fn(async () => workspace),
      createArtifact: vi.fn(async () => artifact),
      inspectArchive: vi.fn(async () => undefined),
      installConsumer: vi.fn(async () => ({
        betterSqlite3: '12.11.1',
        nuxt: '4.5.2',
        nuxtContent: '3.15.2',
        mermaid: '11.12.3',
        typescript: '5.9.3',
        vueTsc: '3.2.5',
      })),
      verifyPackageExports: vi.fn(async () => undefined),
      verifyTypes: vi.fn(async () => undefined),
      buildConsumer: vi.fn(async () => undefined),
      smokeRuntime: vi.fn(async () => undefined),
      cleanupWorkspace: vi.fn(async () => undefined),
    },
  }
}

function createRequest(): PackageArtifactVerificationRequest {
  return {
    packageSource: {
      kind: 'pack',
      repositoryRoot: '/repo',
    },
    profile: knownLatestProfile,
  }
}

describe('package artifact verification runner', () => {
  it('creates one artifact, reuses it for every stage, and reports evidence', async () => {
    const { artifact, operations, workspace } = createOperations()

    const evidence = await runPackageArtifactVerification(createRequest(), operations)

    expect(operations.createArtifact).toHaveBeenCalledOnce()
    expect(operations.createArtifact).toHaveBeenCalledWith({
      repositoryRoot: '/repo',
      artifactDirectory: workspace.artifactDirectory,
    })
    expect(operations.inspectArchive).toHaveBeenCalledWith({
      archiveDirectory: workspace.archiveDirectory,
      artifact,
    })
    expect(operations.installConsumer).toHaveBeenCalledWith({
      artifact,
      consumerDirectory: workspace.consumerDirectory,
      profile: knownLatestProfile,
    })
    expect(operations.verifyPackageExports).toHaveBeenCalledWith({
      artifact,
      consumerDirectory: workspace.consumerDirectory,
    })
    expect(operations.cleanupWorkspace).toHaveBeenCalledWith(workspace.root)
    expect(evidence).toMatchObject({
      success: true,
      mode: 'package-artifact',
      package: {
        name: '@barzhsieh/nuxt-content-mermaid',
        version: '2.2.3',
      },
      artifact: {
        filename: artifact.filename,
        sha256: artifact.sha256,
      },
      profile: {
        id: knownLatestProfile.id,
        requested: knownLatestProfile.versions,
        resolved: knownLatestProfile.versions,
      },
    })
    expect(evidence.stages.map(stage => [stage.name, stage.status])).toEqual([
      ['artifact', 'passed'],
      ['archive', 'passed'],
      ['install', 'passed'],
      ['exports', 'passed'],
      ['types', 'passed'],
      ['build', 'passed'],
      ['runtime', 'passed'],
      ['cleanup', 'passed'],
    ])
  })

  it('rejects a source-linked package before creating temporary state', async () => {
    const { operations } = createOperations()

    await expect(runPackageArtifactVerification({
      packageSource: {
        kind: 'workspace',
        repositoryRoot: '/repo',
      } as never,
      profile: knownLatestProfile,
    }, operations)).rejects.toThrow('Unsupported package source: workspace')
    expect(operations.createWorkspace).not.toHaveBeenCalled()
  })

  it('stops after a required stage fails, reports the stage, and still cleans up', async () => {
    const { operations, workspace } = createOperations()
    operations.verifyTypes.mockRejectedValueOnce(new Error('type contract failed'))

    const failure: ReleaseVerificationFailure
      = await runPackageArtifactVerification(createRequest(), operations)
        .then(
          () => { throw new Error('expected verification to fail') },
          (error: unknown) => error as ReleaseVerificationFailure,
        )

    expect(failure).toBeInstanceOf(ReleaseVerificationFailure)
    expect(failure).toMatchObject({
      stage: 'types',
      evidence: {
        success: false,
      },
    })
    expect(failure.evidence.stages.map(stage => [stage.name, stage.status])).toEqual([
      ['artifact', 'passed'],
      ['archive', 'passed'],
      ['install', 'passed'],
      ['exports', 'passed'],
      ['types', 'failed'],
      ['build', 'skipped'],
      ['runtime', 'skipped'],
      ['cleanup', 'passed'],
    ])
    expect(operations.buildConsumer).not.toHaveBeenCalled()
    expect(operations.smokeRuntime).not.toHaveBeenCalled()
    expect(operations.cleanupWorkspace).toHaveBeenCalledWith(workspace.root)
  })

  it('treats cleanup failure as a required-stage failure', async () => {
    const { operations } = createOperations()
    operations.cleanupWorkspace.mockRejectedValueOnce(new Error('cleanup failed'))

    const failure: ReleaseVerificationFailure
      = await runPackageArtifactVerification(createRequest(), operations)
        .then(
          () => { throw new Error('expected verification to fail') },
          (error: unknown) => error as ReleaseVerificationFailure,
        )

    expect(failure).toBeInstanceOf(ReleaseVerificationFailure)
    expect(failure).toMatchObject({
      stage: 'cleanup',
      evidence: {
        success: false,
      },
    })
    expect(failure.evidence.stages.at(-1)).toMatchObject({
      name: 'cleanup',
      status: 'failed',
      error: 'cleanup failed',
    })
  })
})
