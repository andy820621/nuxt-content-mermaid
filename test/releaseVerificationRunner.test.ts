import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  ReleaseVerificationFailure,
  runPackageArtifactVerification,
} from '../scripts/release-verification/runner.mjs'
import type {
  ConsumerInstallResult,
  PackageArtifact,
  PackageArtifactVerificationRequest,
} from '../scripts/release-verification/runner.mjs'

const knownLatestProfile = {
  id: 'v3-known-latest',
  nodeVersion: process.versions.node,
  versions: {
    betterSqlite3: '12.11.1',
    nuxt: '4.5.2',
    nuxtContent: '3.15.2',
    mermaid: '11.17.0',
    typescript: '5.9.3',
    vueTsc: '3.2.5',
  },
}

const knownLatestProfileWithExpectedResolutions = {
  ...knownLatestProfile,
  expectedResolutions: {
    nuxtKit: '4.5.2',
    nuxtSchema: '4.5.2',
  },
}

function createOperations() {
  const workspace = {
    root: '/tmp/package-artifact-verification',
    artifactDirectory: '/tmp/package-artifact-verification/artifact',
    archiveDirectory: '/tmp/package-artifact-verification/archive',
    consumerDirectory: '/tmp/package-artifact-verification/consumer',
  }
  const artifact = {
    archivePath: join(
      workspace.artifactDirectory,
      'barzhsieh-nuxt-content-mermaid-2.2.3.tgz',
    ),
    filename: 'barzhsieh-nuxt-content-mermaid-2.2.3.tgz',
    sha256: 'abc123',
    packlist: ['dist/module.mjs', 'dist/types.d.mts', 'package.json'],
    packageName: '@barzhsieh/nuxt-content-mermaid',
    packageVersion: '2.2.3',
  }

  return {
    artifact,
    operations: {
      createWorkspace: vi.fn(async () => workspace),
      inspectArchive: vi.fn(async () => undefined),
      installConsumer: vi.fn(async (): Promise<ConsumerInstallResult> => ({
        packageVersion: artifact.packageVersion,
        profileVersions: {
          betterSqlite3: '12.11.1',
          nuxt: '4.5.2',
          nuxtContent: '3.15.2',
          mermaid: '11.17.0',
          typescript: '5.9.3',
          vueTsc: '3.2.5',
        },
      })),
      verifyPackageExports: vi.fn(async () => undefined),
      verifyTypes: vi.fn(async () => undefined),
      buildConsumer: vi.fn(async () => undefined),
      smokeRuntime: vi.fn(async () => undefined),
      cleanupWorkspace: vi.fn(async () => undefined),
    },
    workspace,
  }
}

function createRequest(artifact: PackageArtifact): PackageArtifactVerificationRequest {
  return {
    artifact,
    profile: knownLatestProfile,
  }
}

describe('package artifact verification runner', () => {
  it('reuses one supplied artifact for every stage and reports evidence', async () => {
    const { artifact, operations, workspace } = createOperations()

    const evidence = await runPackageArtifactVerification(createRequest(artifact), operations)

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
      runtime: {
        requested: knownLatestProfile.nodeVersion,
        observed: process.versions.node,
      },
    })
    expect(evidence.profile).not.toHaveProperty('expectedResolutions')
    expect(evidence.stages.map(stage => [stage.name, stage.status])).toEqual([
      ['node-runtime', 'passed'],
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

  it('retains requested and resolved dependency evidence for the final profile', async () => {
    const { artifact, operations } = createOperations()
    operations.installConsumer.mockResolvedValueOnce({
      packageVersion: artifact.packageVersion,
      profileVersions: knownLatestProfileWithExpectedResolutions.versions,
      expectedResolutions: knownLatestProfileWithExpectedResolutions.expectedResolutions,
    })

    const evidence = await runPackageArtifactVerification({
      artifact,
      profile: knownLatestProfileWithExpectedResolutions,
    }, operations)

    expect(evidence.profile).toEqual({
      id: knownLatestProfileWithExpectedResolutions.id,
      requested: knownLatestProfileWithExpectedResolutions.versions,
      resolved: knownLatestProfileWithExpectedResolutions.versions,
      expectedResolutions: {
        requested: knownLatestProfileWithExpectedResolutions.expectedResolutions,
        resolved: knownLatestProfileWithExpectedResolutions.expectedResolutions,
      },
    })
  })

  it('fails installation when the final profile omits expected resolutions', async () => {
    const { artifact, operations } = createOperations()
    operations.installConsumer.mockResolvedValueOnce({
      packageVersion: artifact.packageVersion,
      profileVersions: knownLatestProfileWithExpectedResolutions.versions,
    })

    const failure: ReleaseVerificationFailure
      = await runPackageArtifactVerification({
        artifact,
        profile: knownLatestProfileWithExpectedResolutions,
      }, operations).then(
        () => { throw new Error('expected verification to fail') },
        (error: unknown) => error as ReleaseVerificationFailure,
      )

    expect(failure.stage).toBe('install')
    expect(failure.evidence.profile).toMatchObject({
      expectedResolutions: {
        requested: knownLatestProfileWithExpectedResolutions.expectedResolutions,
        resolved: null,
      },
    })
  })

  it('rejects a mismatched Node runtime before creating temporary state', async () => {
    const { artifact, operations } = createOperations()
    const requestedNodeVersion = '0.0.1'

    const failure: ReleaseVerificationFailure
      = await runPackageArtifactVerification({
        artifact,
        profile: {
          ...knownLatestProfile,
          nodeVersion: requestedNodeVersion,
        },
      }, operations).then(
        () => { throw new Error('expected verification to fail') },
        (error: unknown) => error as ReleaseVerificationFailure,
      )

    expect(failure).toBeInstanceOf(ReleaseVerificationFailure)
    expect(failure).toMatchObject({
      stage: 'node-runtime',
      evidence: {
        success: false,
        runtime: {
          requested: requestedNodeVersion,
          observed: process.versions.node,
        },
      },
    })
    expect(operations.createWorkspace).not.toHaveBeenCalled()
    expect(failure.evidence.stages.map(stage => [stage.name, stage.status])).toEqual([
      ['node-runtime', 'failed'],
      ['artifact', 'skipped'],
      ['archive', 'skipped'],
      ['install', 'skipped'],
      ['exports', 'skipped'],
      ['types', 'skipped'],
      ['build', 'skipped'],
      ['runtime', 'skipped'],
      ['cleanup', 'skipped'],
    ])
  })

  it('stops after a required stage fails and still cleans up', async () => {
    const { artifact, operations, workspace } = createOperations()
    operations.verifyTypes.mockRejectedValueOnce(new Error('type contract failed'))

    const failure: ReleaseVerificationFailure
      = await runPackageArtifactVerification(createRequest(artifact), operations)
        .then(
          () => { throw new Error('expected verification to fail') },
          (error: unknown) => error as ReleaseVerificationFailure,
        )

    expect(failure).toMatchObject({
      stage: 'types',
      evidence: { success: false },
    })
    expect(failure.evidence.stages.map(stage => [stage.name, stage.status])).toEqual([
      ['node-runtime', 'passed'],
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
    const { artifact, operations } = createOperations()
    operations.cleanupWorkspace.mockRejectedValueOnce(new Error('cleanup failed'))

    const failure: ReleaseVerificationFailure
      = await runPackageArtifactVerification(createRequest(artifact), operations)
        .then(
          () => { throw new Error('expected verification to fail') },
          (error: unknown) => error as ReleaseVerificationFailure,
        )

    expect(failure).toMatchObject({
      stage: 'cleanup',
      evidence: { success: false },
    })
    expect(failure.evidence.stages.at(-1)).toMatchObject({
      name: 'cleanup',
      status: 'failed',
      error: 'cleanup failed',
    })
  })
})
