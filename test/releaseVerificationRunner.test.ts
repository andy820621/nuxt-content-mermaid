import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  CompatibilityMatrixVerificationFailure,
  ReleaseVerificationFailure,
  RegistrySmokeVerificationFailure,
  runPackageArtifactVerification,
  runPackageArtifactMatrixVerification,
  runRegistrySmokeVerification,
} from '../scripts/release-verification/runner.mjs'
import type {
  ConsumerInstallResult,
  PackageArtifact,
  PackageArtifactEvidence,
  PackageArtifactVerificationRequest,
  VersionProfile,
} from '../scripts/release-verification/runner.mjs'

const knownLatestProfile = {
  id: 'v3-known-latest',
  nodeVersion: process.versions.node,
  versions: {
    betterSqlite3: '12.11.1',
    nuxt: '4.5.2',
    nuxtContent: '3.15.2',
    mermaid: '11.16.1',
    typescript: '5.9.3',
    vueTsc: '3.2.5',
  },
}

const minimumProfile = {
  id: 'v3-minimum',
  nodeVersion: process.versions.node,
  versions: {
    betterSqlite3: '12.11.1',
    nuxt: '4.1.0',
    nuxtContent: '3.5.0',
    mermaid: '11.16.1',
    typescript: '5.9.3',
    vueTsc: '3.2.5',
  },
}

const knownLatestProfileWithExpectedResolutions = {
  id: 'v3-known-latest',
  nodeVersion: process.versions.node,
  versions: {
    ...knownLatestProfile.versions,
  },
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
      loadArtifact: vi.fn(async () => artifact),
      inspectArchive: vi.fn(async () => undefined),
      installConsumer: vi.fn(async (): Promise<ConsumerInstallResult> => ({
        packageVersion: artifact.packageVersion,
        profileVersions: {
          betterSqlite3: '12.11.1',
          nuxt: '4.5.2',
          nuxtContent: '3.15.2',
          mermaid: '11.16.1',
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

function createRequest(artifact: PackageArtifact): PackageArtifactVerificationRequest {
  return {
    packageSource: {
      kind: 'artifact',
      artifact,
    },
    profile: knownLatestProfile,
  }
}

function createChildEvidence(
  artifact: PackageArtifact,
  profile: VersionProfile,
): PackageArtifactEvidence {
  return {
    schemaVersion: 1,
    success: true,
    mode: 'package-artifact',
    package: {
      name: artifact.packageName,
      version: artifact.packageVersion,
    },
    artifact: {
      filename: artifact.filename,
      sha256: artifact.sha256,
    },
    profile: {
      id: profile.id,
      requested: profile.versions,
      resolved: profile.versions,
      ...(profile.expectedResolutions
        ? {
            expectedResolutions: {
              requested: profile.expectedResolutions,
              resolved: profile.expectedResolutions,
            },
          }
        : {}),
    },
    runtime: {
      requested: profile.nodeVersion,
      observed: profile.nodeVersion,
    },
    stages: [{ name: 'runtime', status: 'passed' }],
  }
}

describe('package artifact verification runner', () => {
  it('reuses one supplied artifact for every stage and reports evidence', async () => {
    const { artifact, operations, workspace } = createOperations()

    const evidence = await runPackageArtifactVerification(createRequest(artifact), operations)

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

  it('retains shallow requested and resolved toolchain evidence for a final profile', async () => {
    const { artifact, operations } = createOperations()
    operations.installConsumer.mockResolvedValueOnce({
      packageVersion: '2.2.3',
      profileVersions: knownLatestProfileWithExpectedResolutions.versions,
      expectedResolutions: knownLatestProfileWithExpectedResolutions.expectedResolutions,
    })

    const evidence = await runPackageArtifactVerification({
      packageSource: {
        kind: 'artifact',
        artifact,
      },
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

  it('fails installation when a final profile does not report its expected resolutions', async () => {
    const { artifact, operations } = createOperations()
    operations.installConsumer.mockResolvedValueOnce({
      packageVersion: '2.2.3',
      profileVersions: knownLatestProfileWithExpectedResolutions.versions,
    })

    const failure: ReleaseVerificationFailure
      = await runPackageArtifactVerification({
        packageSource: {
          kind: 'artifact',
          artifact,
        },
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
    expect(failure.evidence.stages).toContainEqual(expect.objectContaining({
      name: 'install',
      status: 'failed',
    }))
  })

  it('verifies an artifact without packing another archive', async () => {
    const { artifact, operations, workspace } = createOperations()

    const evidence = await runPackageArtifactVerification({
      packageSource: {
        kind: 'artifact',
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

  it('rejects a mismatched Node runtime before creating temporary state', async () => {
    const { artifact, operations } = createOperations()
    const requestedNodeVersion = '0.0.1'

    const failure: ReleaseVerificationFailure
      = await runPackageArtifactVerification({
        ...createRequest(artifact),
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
    expect(failure.message).toContain(
      `requested ${requestedNodeVersion}, observed ${process.versions.node}`,
    )
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

  it('stops after a required stage fails, reports the stage, and still cleans up', async () => {
    const { artifact, operations, workspace } = createOperations()
    operations.verifyTypes.mockRejectedValueOnce(new Error('type contract failed'))

    const failure: ReleaseVerificationFailure
      = await runPackageArtifactVerification(createRequest(artifact), operations)
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

describe('registry smoke verification runner', () => {
  it('runs the fixed registry plan in one clean consumer', async () => {
    const { operations, workspace } = createOperations()
    const installResult = {
      packageVersion: '3.0.7',
      profileVersions: {
        betterSqlite3: '12.11.1',
        nuxt: '4.5.3',
        nuxtContent: '3.15.2',
        mermaid: '11.16.1',
        typescript: '5.9.3',
        vueTsc: '3.2.5',
      },
    }
    operations.installConsumer.mockResolvedValueOnce(installResult)

    const evidence = await runRegistrySmokeVerification({
      packageName: '@barzhsieh/nuxt-content-mermaid',
      packageVersion: '3.0.0',
      profile: knownLatestProfile,
    }, operations)

    expect(operations.createArtifact).not.toHaveBeenCalled()
    expect(operations.inspectArchive).not.toHaveBeenCalled()
    expect(operations.verifyPackageExports).not.toHaveBeenCalled()
    expect(operations.verifyTypes).not.toHaveBeenCalled()
    expect(operations.installConsumer).toHaveBeenCalledWith({
      packageSource: {
        kind: 'registry',
        packageName: '@barzhsieh/nuxt-content-mermaid',
        packageVersion: '3.0.0',
      },
      consumerDirectory: workspace.consumerDirectory,
      profile: knownLatestProfile,
    })
    expect(evidence).toMatchObject({
      package: {
        name: '@barzhsieh/nuxt-content-mermaid',
        requestedVersion: '3.0.0',
      },
      profile: {
        id: 'v3-known-latest',
        requested: knownLatestProfile.versions,
      },
      runtime: {
        requested: knownLatestProfile.nodeVersion,
        observed: process.versions.node,
      },
    })
    expect(evidence.package.resolvedVersion).toBe(installResult.packageVersion)
    expect(evidence.profile.resolved).toBe(installResult.profileVersions)
    expect(evidence.stages.map(stage => [stage.name, stage.status])).toEqual([
      ['node-runtime', 'passed'],
      ['install', 'passed'],
      ['build', 'passed'],
      ['runtime', 'passed'],
      ['cleanup', 'passed'],
    ])
  })

  it.each([
    'latest',
    '^3.0.0',
    'workspace:*',
    'file:../package.tgz',
    '/tmp/package.tgz',
    'https://registry.npmjs.org/@barzhsieh/nuxt-content-mermaid/-/nuxt-content-mermaid-3.0.0.tgz',
    'git+https://github.com/barzhsieh/nuxt-content-mermaid.git',
  ])('rejects the non-exact version %s before creating a workspace', async (packageVersion) => {
    const { operations } = createOperations()

    await expect(runRegistrySmokeVerification({
      packageName: '@barzhsieh/nuxt-content-mermaid',
      packageVersion,
      profile: knownLatestProfile,
    }, operations)).rejects.toThrow('Registry smoke requires an exact package version')

    expect(operations.createWorkspace).not.toHaveBeenCalled()
  })

  it('skips only build and runtime when installation fails', async () => {
    const { operations } = createOperations()
    operations.installConsumer.mockRejectedValueOnce(new Error('install failed'))

    const failure: RegistrySmokeVerificationFailure
      = await runRegistrySmokeVerification({
        packageName: '@barzhsieh/nuxt-content-mermaid',
        packageVersion: '3.0.0',
        profile: knownLatestProfile,
      }, operations).then(
        () => { throw new Error('expected verification to fail') },
        (error: unknown) => error as RegistrySmokeVerificationFailure,
      )

    expect(failure).toBeInstanceOf(RegistrySmokeVerificationFailure)
    expect(failure.evidence.stages.map(stage => [stage.name, stage.status])).toEqual([
      ['node-runtime', 'passed'],
      ['install', 'failed'],
      ['build', 'skipped'],
      ['runtime', 'skipped'],
      ['cleanup', 'passed'],
    ])
  })

  it('skips only runtime when the build fails', async () => {
    const { operations } = createOperations()
    operations.buildConsumer.mockRejectedValueOnce(new Error('build failed'))

    const failure: RegistrySmokeVerificationFailure
      = await runRegistrySmokeVerification({
        packageName: '@barzhsieh/nuxt-content-mermaid',
        packageVersion: '3.0.0',
        profile: knownLatestProfile,
      }, operations).then(
        () => { throw new Error('expected verification to fail') },
        (error: unknown) => error as RegistrySmokeVerificationFailure,
      )

    expect(failure).toMatchObject({ stage: 'build' })
    expect(failure.evidence.stages.map(stage => [stage.name, stage.status])).toEqual([
      ['node-runtime', 'passed'],
      ['install', 'passed'],
      ['build', 'failed'],
      ['runtime', 'skipped'],
      ['cleanup', 'passed'],
    ])
  })

  it('reports the runtime stage when the smoke test fails', async () => {
    const { operations } = createOperations()
    operations.smokeRuntime.mockRejectedValueOnce(new Error('runtime failed'))

    const failure: RegistrySmokeVerificationFailure
      = await runRegistrySmokeVerification({
        packageName: '@barzhsieh/nuxt-content-mermaid',
        packageVersion: '3.0.0',
        profile: knownLatestProfile,
      }, operations).then(
        () => { throw new Error('expected verification to fail') },
        (error: unknown) => error as RegistrySmokeVerificationFailure,
      )

    expect(failure).toMatchObject({ stage: 'runtime' })
    expect(failure.evidence.stages.map(stage => [stage.name, stage.status])).toEqual([
      ['node-runtime', 'passed'],
      ['install', 'passed'],
      ['build', 'passed'],
      ['runtime', 'failed'],
      ['cleanup', 'passed'],
    ])
  })

  it('treats cleanup failure as a required registry-stage failure', async () => {
    const { operations } = createOperations()
    operations.cleanupWorkspace.mockRejectedValueOnce(new Error('cleanup failed'))

    const failure: RegistrySmokeVerificationFailure
      = await runRegistrySmokeVerification({
        packageName: '@barzhsieh/nuxt-content-mermaid',
        packageVersion: '3.0.0',
        profile: knownLatestProfile,
      }, operations).then(
        () => { throw new Error('expected verification to fail') },
        (error: unknown) => error as RegistrySmokeVerificationFailure,
      )

    expect(failure).toMatchObject({ stage: 'cleanup' })
    expect(failure.evidence.stages.map(stage => [stage.name, stage.status])).toEqual([
      ['node-runtime', 'passed'],
      ['install', 'passed'],
      ['build', 'passed'],
      ['runtime', 'passed'],
      ['cleanup', 'failed'],
    ])
  })
})

describe('multi-profile package artifact runner', () => {
  it('aggregates sequential child evidence for one retained artifact', async () => {
    const { artifact } = createOperations()
    const profiles = [minimumProfile, knownLatestProfile]
    const verifyProfile = vi.fn(async ({ profile }: { profile: VersionProfile }) => (
      createChildEvidence(artifact, profile)
    ))

    const evidence = await runPackageArtifactMatrixVerification({
      artifact,
      profiles,
    }, verifyProfile)

    expect(verifyProfile).toHaveBeenNthCalledWith(1, {
      artifact,
      profile: minimumProfile,
    })
    expect(verifyProfile).toHaveBeenNthCalledWith(2, {
      artifact,
      profile: knownLatestProfile,
    })
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
    const { artifact } = createOperations()
    const failedEvidence: PackageArtifactEvidence = {
      ...createChildEvidence(artifact, minimumProfile),
      success: false,
      stages: [
        { name: 'node-runtime', status: 'passed' },
        { name: 'install', status: 'passed' },
        { name: 'exports', status: 'passed' },
        { name: 'types', status: 'failed', error: 'minimum type contract failed' },
        { name: 'build', status: 'skipped', reason: 'required stage types failed' },
        { name: 'runtime', status: 'skipped', reason: 'required stage types failed' },
        { name: 'cleanup', status: 'passed' },
      ],
    }
    const verifyProfile = vi.fn(async ({ profile }: { profile: VersionProfile }) => {
      if (profile.id === minimumProfile.id) {
        throw new ReleaseVerificationFailure(
          'types',
          new Error('minimum type contract failed'),
          failedEvidence,
        )
      }
      return createChildEvidence(artifact, profile)
    })

    const failure: CompatibilityMatrixVerificationFailure
      = await runPackageArtifactMatrixVerification({
        artifact,
        profiles: [minimumProfile, knownLatestProfile],
      }, verifyProfile)
        .then(
          () => { throw new Error('expected matrix verification to fail') },
          (error: unknown) => error as CompatibilityMatrixVerificationFailure,
        )

    expect(failure).toBeInstanceOf(CompatibilityMatrixVerificationFailure)
    expect(failure.failures).toMatchObject([{
      profileId: minimumProfile.id,
      stage: 'types',
    }])
    expect(verifyProfile).toHaveBeenCalledTimes(2)
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
          ['node-runtime', 'passed'],
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
        stages: [['runtime', 'passed']],
      },
    ])
  })

  it('rejects child requested coordinates that differ from the frozen profile', async () => {
    const { artifact } = createOperations()
    const verifyProfile = vi.fn(async ({ profile }: { profile: VersionProfile }) => {
      const evidence = createChildEvidence(artifact, profile)
      if (profile.id !== knownLatestProfile.id) return evidence
      return {
        ...evidence,
        profile: {
          ...evidence.profile,
          requested: {
            ...evidence.profile.requested,
            nuxt: '4.9.0',
          },
        },
      }
    })

    const failure: CompatibilityMatrixVerificationFailure
      = await runPackageArtifactMatrixVerification({
        artifact,
        profiles: [minimumProfile, knownLatestProfile],
      }, verifyProfile).then(
        () => { throw new Error('expected matrix verification to fail') },
        (error: unknown) => error as CompatibilityMatrixVerificationFailure,
      )

    expect(failure.failures).toMatchObject([{
      profileId: knownLatestProfile.id,
      stage: 'artifact',
    }])
    expect(failure.failures[0]?.cause).toMatchObject({
      message: expect.stringContaining('mismatched requested coordinates'),
    })
    expect(failure.evidence.profiles).toHaveLength(1)
    expect(failure.evidence.profiles[0]?.id).toBe(minimumProfile.id)
  })

  it('rejects an empty matrix before invoking the outer verifier', async () => {
    const { artifact } = createOperations()
    const verifyProfile = vi.fn()

    await expect(runPackageArtifactMatrixVerification({
      artifact,
      profiles: [],
    }, verifyProfile)).rejects.toThrow('at least one Version Profile')
    expect(verifyProfile).not.toHaveBeenCalled()
  })
})
