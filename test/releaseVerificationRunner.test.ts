import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  CompatibilityMatrixVerificationFailure,
  ReleaseVerificationFailure,
  runPackageArtifactVerification,
  runPackageArtifactMatrixVerification,
} from '../scripts/release-verification/runner.mjs'
import type {
  PackageArtifactMatrixVerificationRequest,
  PackageArtifactVerificationRequest,
} from '../scripts/release-verification/runner.mjs'

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

const minimumProfile = {
  id: 'nuxt-3-minimum',
  versions: {
    betterSqlite3: '12.11.1',
    nuxt: '3.20.1',
    nuxtContent: '3.5.0',
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
    integritySha512: 'sha512-Zml4dHVyZQ==',
    packlist: ['dist/module.mjs', 'dist/types.d.mts', 'package.json'],
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
        packageVersion: artifact.packageVersion,
        profileVersions: {
          betterSqlite3: '12.11.1',
          nuxt: '4.5.2',
          nuxtContent: '3.15.2',
          mermaid: '11.12.3',
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

function createMatrixRequest(): PackageArtifactMatrixVerificationRequest {
  return {
    packageSource: {
      kind: 'pack',
      repositoryRoot: '/repo',
    },
    profiles: [minimumProfile, knownLatestProfile],
  }
}

function createMatrixOperations() {
  const { artifact } = createOperations()
  const workspaces = [
    {
      root: '/tmp/matrix-artifact',
      artifactDirectory: '/tmp/matrix-artifact/artifact',
      archiveDirectory: '/tmp/matrix-artifact/archive',
      consumerDirectory: '/tmp/matrix-artifact/consumer',
    },
    {
      root: '/tmp/matrix-nuxt-3-minimum',
      artifactDirectory: '/tmp/matrix-nuxt-3-minimum/artifact',
      archiveDirectory: '/tmp/matrix-nuxt-3-minimum/archive',
      consumerDirectory: '/tmp/matrix-nuxt-3-minimum/consumer',
    },
    {
      root: '/tmp/matrix-nuxt-4-known-latest',
      artifactDirectory: '/tmp/matrix-nuxt-4-known-latest/artifact',
      archiveDirectory: '/tmp/matrix-nuxt-4-known-latest/archive',
      consumerDirectory: '/tmp/matrix-nuxt-4-known-latest/consumer',
    },
  ]
  const resolvedVersions = new Map([
    [minimumProfile.id, minimumProfile.versions],
    [knownLatestProfile.id, knownLatestProfile.versions],
  ])
  const operations = {
    createWorkspace: vi.fn(async () => {
      const workspace = workspaces[operations.createWorkspace.mock.calls.length - 1]
      if (!workspace) throw new Error('unexpected workspace request')
      return workspace
    }),
    createArtifact: vi.fn(async () => artifact),
    inspectArchive: vi.fn(async () => undefined),
    installConsumer: vi.fn(async ({ profile }: { profile: typeof minimumProfile }) => ({
      packageVersion: artifact.packageVersion,
      profileVersions: resolvedVersions.get(profile.id)!,
    })),
    verifyPackageExports: vi.fn(async () => undefined),
    verifyTypes: vi.fn(async () => undefined),
    buildConsumer: vi.fn(async () => undefined),
    smokeRuntime: vi.fn(async () => undefined),
    cleanupWorkspace: vi.fn(async () => undefined),
  }
  return { artifact, operations, workspaces }
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
      packageSource: { kind: 'artifact', artifact },
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

  it('verifies a retained artifact without packing another archive', async () => {
    const { artifact, operations, workspace } = createOperations()

    const evidence = await runPackageArtifactVerification({
      packageSource: {
        kind: 'retained',
        artifact,
      },
      profile: knownLatestProfile,
    }, operations)

    expect(operations.createArtifact).not.toHaveBeenCalled()
    expect(operations.inspectArchive).toHaveBeenCalledWith({
      archiveDirectory: workspace.archiveDirectory,
      artifact,
    })
    expect(operations.installConsumer).toHaveBeenCalledWith({
      packageSource: { kind: 'artifact', artifact },
      consumerDirectory: workspace.consumerDirectory,
      profile: knownLatestProfile,
    })
    expect(evidence).toMatchObject({
      success: true,
      package: {
        name: artifact.packageName,
        version: artifact.packageVersion,
      },
      artifact: {
        filename: artifact.filename,
        sha256: artifact.sha256,
      },
    })
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

describe('Representative Compatibility Matrix runner', () => {
  it('reuses one artifact while running the complete consumer contract for every profile', async () => {
    const { artifact, operations, workspaces } = createMatrixOperations()

    const evidence = await runPackageArtifactMatrixVerification(
      createMatrixRequest(),
      operations,
    )

    expect(operations.createArtifact).toHaveBeenCalledOnce()
    expect(operations.inspectArchive).toHaveBeenCalledOnce()
    expect(operations.installConsumer).toHaveBeenCalledTimes(2)
    expect(operations.installConsumer).toHaveBeenNthCalledWith(1, {
      packageSource: { kind: 'artifact', artifact },
      consumerDirectory: workspaces[1]!.consumerDirectory,
      profile: minimumProfile,
    })
    expect(operations.installConsumer).toHaveBeenNthCalledWith(2, {
      packageSource: { kind: 'artifact', artifact },
      consumerDirectory: workspaces[2]!.consumerDirectory,
      profile: knownLatestProfile,
    })
    expect(operations.verifyPackageExports).toHaveBeenCalledTimes(2)
    expect(operations.verifyTypes).toHaveBeenCalledTimes(2)
    expect(operations.buildConsumer).toHaveBeenCalledTimes(2)
    expect(operations.smokeRuntime).toHaveBeenCalledTimes(2)
    expect(operations.cleanupWorkspace).toHaveBeenCalledTimes(3)
    expect(evidence).toMatchObject({
      success: true,
      mode: 'package-artifact-matrix',
      package: {
        name: artifact.packageName,
        version: artifact.packageVersion,
      },
      artifact: {
        filename: artifact.filename,
        sha256: artifact.sha256,
      },
      profiles: [
        {
          id: minimumProfile.id,
          requested: minimumProfile.versions,
          resolved: minimumProfile.versions,
          success: true,
        },
        {
          id: knownLatestProfile.id,
          requested: knownLatestProfile.versions,
          resolved: knownLatestProfile.versions,
          success: true,
        },
      ],
    })
  })

  it('continues after a profile fails and rejects with complete matrix evidence', async () => {
    const { operations } = createMatrixOperations()
    operations.verifyTypes.mockRejectedValueOnce(new Error('minimum type contract failed'))

    const failure: CompatibilityMatrixVerificationFailure
      = await runPackageArtifactMatrixVerification(createMatrixRequest(), operations)
        .then(
          () => { throw new Error('expected matrix verification to fail') },
          (error: unknown) => error as CompatibilityMatrixVerificationFailure,
        )

    expect(failure).toBeInstanceOf(CompatibilityMatrixVerificationFailure)
    expect(failure.failures).toMatchObject([{
      profileId: minimumProfile.id,
      stage: 'types',
    }])
    expect(failure.evidence.success).toBe(false)
    expect(failure.evidence.profiles.map(profile => ({
      id: profile.id,
      success: profile.success,
      stages: profile.stages.map(stage => [stage.name, stage.status]),
    }))).toEqual([
      {
        id: minimumProfile.id,
        success: false,
        stages: [
          ['install', 'passed'],
          ['exports', 'passed'],
          ['types', 'failed'],
          ['build', 'skipped'],
          ['runtime', 'skipped'],
          ['cleanup', 'passed'],
        ],
      },
      {
        id: knownLatestProfile.id,
        success: true,
        stages: [
          ['install', 'passed'],
          ['exports', 'passed'],
          ['types', 'passed'],
          ['build', 'passed'],
          ['runtime', 'passed'],
          ['cleanup', 'passed'],
        ],
      },
    ])
  })

  it('rejects an empty matrix before creating temporary state', async () => {
    const { operations } = createMatrixOperations()

    await expect(runPackageArtifactMatrixVerification({
      ...createMatrixRequest(),
      profiles: [],
    }, operations)).rejects.toThrow('at least one Version Profile')
    expect(operations.createWorkspace).not.toHaveBeenCalled()
  })
})
