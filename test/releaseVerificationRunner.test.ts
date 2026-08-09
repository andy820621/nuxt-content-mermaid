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
  PackageArtifactMatrixVerificationRequest,
  PackageArtifactVerificationRequest,
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
      root: '/tmp/matrix-v3-minimum',
      artifactDirectory: '/tmp/matrix-v3-minimum/artifact',
      archiveDirectory: '/tmp/matrix-v3-minimum/archive',
      consumerDirectory: '/tmp/matrix-v3-minimum/consumer',
    },
    {
      root: '/tmp/matrix-v3-known-latest',
      artifactDirectory: '/tmp/matrix-v3-known-latest/artifact',
      archiveDirectory: '/tmp/matrix-v3-known-latest/archive',
      consumerDirectory: '/tmp/matrix-v3-known-latest/consumer',
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
    const { operations } = createOperations()
    operations.installConsumer.mockResolvedValueOnce({
      packageVersion: '2.2.3',
      profileVersions: knownLatestProfileWithExpectedResolutions.versions,
      expectedResolutions: knownLatestProfileWithExpectedResolutions.expectedResolutions,
    })

    const evidence = await runPackageArtifactVerification({
      packageSource: {
        kind: 'pack',
        repositoryRoot: '/repo',
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
    const { operations } = createOperations()
    operations.installConsumer.mockResolvedValueOnce({
      packageVersion: '2.2.3',
      profileVersions: knownLatestProfileWithExpectedResolutions.versions,
    })

    const failure: ReleaseVerificationFailure
      = await runPackageArtifactVerification({
        packageSource: {
          kind: 'pack',
          repositoryRoot: '/repo',
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

  it('rejects a mismatched Node runtime before creating temporary state', async () => {
    const { operations } = createOperations()
    const requestedNodeVersion = '0.0.1'

    const failure: ReleaseVerificationFailure
      = await runPackageArtifactVerification({
        ...createRequest(),
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
        stages: [
          ['node-runtime', 'passed'],
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

  it('rejects a profile whose declared Node runtime does not match the matrix process', async () => {
    const { operations } = createMatrixOperations()
    const mismatchedProfile = {
      ...knownLatestProfile,
      nodeVersion: '0.0.1',
    }

    const failure: CompatibilityMatrixVerificationFailure
      = await runPackageArtifactMatrixVerification({
        ...createMatrixRequest(),
        profiles: [minimumProfile, mismatchedProfile],
      }, operations).then(
        () => { throw new Error('expected matrix verification to fail') },
        (error: unknown) => error as CompatibilityMatrixVerificationFailure,
      )

    expect(failure.failures).toMatchObject([{
      profileId: mismatchedProfile.id,
      stage: 'node-runtime',
    }])
    expect(operations.installConsumer).toHaveBeenCalledTimes(1)
    expect(failure.evidence.profiles[1]).toMatchObject({
      runtime: {
        requested: mismatchedProfile.nodeVersion,
        observed: process.versions.node,
      },
      stages: [
        { name: 'node-runtime', status: 'failed' },
        { name: 'install', status: 'skipped' },
        { name: 'exports', status: 'skipped' },
        { name: 'types', status: 'skipped' },
        { name: 'build', status: 'skipped' },
        { name: 'runtime', status: 'skipped' },
        { name: 'cleanup', status: 'skipped' },
      ],
    })
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
