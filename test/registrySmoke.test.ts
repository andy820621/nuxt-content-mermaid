import { describe, expect, it, vi } from 'vitest'
import {
  ReleaseVerificationPackageUserError,
  classifyRegistrySmokeFailure,
} from '../scripts/release-verification/failure-classification.mjs'
import { RegistrySmokeVerificationFailure } from '../scripts/release-verification/runner.mjs'
import type { RegistrySmokeVerificationEvidence } from '../scripts/release-verification/runner.mjs'
import type { LeanReleaseEvidence } from '../scripts/release-verification/release.mjs'
import {
  createPendingRegistryHealth,
  runInitialRegistrySmoke,
  runRegistrySmokeRetry,
} from '../scripts/release-verification/registry-smoke.mjs'

describe('registry smoke failure classification', () => {
  it.each([
    [Object.assign(new Error('npm registry unavailable'), { code: 'E503' }), 'registry'],
    [Object.assign(new Error('network unreachable'), { code: 'ENETUNREACH' }), 'network'],
    [Object.assign(new Error('spawn browser ENOENT'), { code: 'ENOENT' }), 'runner'],
    [Object.assign(new Error('permission denied'), { code: 'EACCES' }), 'permission'],
    [new ReleaseVerificationPackageUserError('SVG is empty'), 'package-defect'],
  ])('classifies %s as %s', (error, expected) => {
    expect(classifyRegistrySmokeFailure(error)).toBe(expected)
  })

  it.each([
    [
      new ReleaseVerificationPackageUserError('SVG is empty', {
        cause: Object.assign(new Error('permission denied'), { code: 'EACCES' }),
      }),
      'permission',
    ],
    [
      new ReleaseVerificationPackageUserError('SVG is empty', {
        cause: Object.assign(new Error('operation not permitted'), { code: 'EPERM' }),
      }),
      'permission',
    ],
    [
      new ReleaseVerificationPackageUserError('SVG is empty', {
        cause: Object.assign(new Error('network unreachable'), { code: 'ENETUNREACH' }),
      }),
      'network',
    ],
    [
      new ReleaseVerificationPackageUserError('SVG is empty', {
        cause: Object.assign(new Error('npm registry unavailable'), { code: 'E503' }),
      }),
      'registry',
    ],
    [
      new ReleaseVerificationPackageUserError('SVG is empty', {
        cause: Object.assign(new Error('spawn browser ENOENT'), { code: 'ENOENT' }),
      }),
      'runner',
    ],
  ])('prefers nested external %s over a Package User wrapper', (error, expected) => {
    expect(classifyRegistrySmokeFailure(error)).toBe(expected)
  })

  function createNpmTargetFailure(packageSpec: string) {
    const stderr = [
      'npm ERR! code ETARGET',
      `npm ERR! notarget No matching version found for ${packageSpec}.`,
      'npm ERR! notarget In most cases you or one of your dependencies are requesting',
      'npm ERR! notarget a package version that does not exist.',
    ].join('\n')
    const executionFailure = Object.assign(
      new Error(`Command failed: npm install --no-audit --no-fund --package-lock=true\n${stderr}`),
      { code: 1, stdout: '', stderr },
    )
    return new ReleaseVerificationPackageUserError(
      `npm install failed\nstderr:\n${stderr}`,
      { cause: executionFailure },
    )
  }

  it('classifies a wrapped npm ETARGET for the root exact version as registry', () => {
    const error = createNpmTargetFailure('@barzhsieh/nuxt-content-mermaid@3.0.0')

    expect(classifyRegistrySmokeFailure(error)).toBe('registry')
  })

  it('keeps a wrapped dependency ETARGET classified as a package defect', () => {
    const error = createNpmTargetFailure('@nuxt/content@99.0.0')

    expect(classifyRegistrySmokeFailure(error)).toBe('package-defect')
  })

  it('treats an unknown cycle as a runner failure', () => {
    const error = new Error('unknown external failure')
    Object.assign(error, { cause: error })

    expect(classifyRegistrySmokeFailure(error)).toBe('runner')
  })
})

const frozenRegistryProfile = {
  id: 'v3-known-latest',
  nodeVersion: process.versions.node,
  versions: {
    betterSqlite3: '12.11.1',
    nuxt: '4.5.3',
    nuxtContent: '3.15.2',
    mermaid: '11.16.1',
    typescript: '5.9.3',
    vueTsc: '3.2.5',
  },
}

function createRegistryHealth() {
  return createPendingRegistryHealth({
    packageName: '@barzhsieh/nuxt-content-mermaid',
    packageVersion: '3.0.0',
    requestedProfile: {
      nuxt: '>=4.1.0 <5.0.0',
      nuxtContent: '>=3.5.0 <4.0.0',
    },
    profile: frozenRegistryProfile,
  })
}

function createVerificationEvidence(success: boolean): RegistrySmokeVerificationEvidence {
  return {
    schemaVersion: 1 as const,
    success,
    mode: 'registry-smoke' as const,
    package: {
      name: '@barzhsieh/nuxt-content-mermaid',
      requestedVersion: '3.0.0',
      resolvedVersion: '3.0.0',
    },
    profile: {
      id: frozenRegistryProfile.id,
      requested: frozenRegistryProfile.versions,
      resolved: frozenRegistryProfile.versions,
    },
    runtime: {
      requested: frozenRegistryProfile.nodeVersion,
      observed: process.versions.node,
    },
    stages: [],
  }
}

const invalidSuccessfulVerificationCases: Array<[
  string,
  (verification: RegistrySmokeVerificationEvidence) => void,
]> = [
  ['success: false', (verification) => {
    verification.success = false
  }],
  ['the wrong mode', (verification) => {
    Object.assign(verification, { mode: 'package-artifact' })
  }],
  ['the wrong package name', (verification) => {
    verification.package.name = '@example/wrong-package'
  }],
  ['the wrong requested package version', (verification) => {
    verification.package.requestedVersion = '3.0.1'
  }],
  ['the wrong resolved package version', (verification) => {
    verification.package.resolvedVersion = '3.0.1'
  }],
  ['the wrong requested profile', (verification) => {
    verification.profile.requested = {
      ...verification.profile.requested,
      nuxt: '4.5.2',
    }
  }],
  ['the wrong resolved profile', (verification) => {
    verification.profile.resolved = {
      ...frozenRegistryProfile.versions,
      nuxt: '4.5.2',
    }
  }],
]

async function createPublishedInvestigationEvidence() {
  const registryHealth = await runInitialRegistrySmoke({
    registryHealth: createRegistryHealth(),
    verifyRegistryPackage: async () => {
      throw new RegistrySmokeVerificationFailure(
        'runtime',
        new ReleaseVerificationPackageUserError('SVG is empty'),
        createVerificationEvidence(false),
      )
    },
    now: () => '2026-08-09T01:00:00.000Z',
  })

  return {
    schemaVersion: 1 as const,
    status: 'published' as const,
    identity: { targetVersion: '3.0.0' },
    artifact: { packageVersion: '3.0.0' },
    registryHealth,
  }
}

async function createPublishedInstallInvestigationEvidence() {
  const installFailureVerification: RegistrySmokeVerificationEvidence = {
    ...createVerificationEvidence(false),
    package: {
      name: '@barzhsieh/nuxt-content-mermaid',
      requestedVersion: '3.0.0',
      resolvedVersion: null,
    },
    profile: {
      id: frozenRegistryProfile.id,
      requested: frozenRegistryProfile.versions,
      resolved: null,
    },
    stages: [
      { name: 'install', status: 'failed', durationMs: 1, error: 'registry unavailable' },
      { name: 'build', status: 'skipped', reason: 'required stage install failed' },
      { name: 'runtime', status: 'skipped', reason: 'required stage install failed' },
      { name: 'cleanup', status: 'passed', durationMs: 1 },
    ],
  }
  const registryHealth = await runInitialRegistrySmoke({
    registryHealth: createRegistryHealth(),
    verifyRegistryPackage: async () => {
      throw new RegistrySmokeVerificationFailure(
        'install',
        Object.assign(new Error('npm registry unavailable'), { code: 'E503' }),
        installFailureVerification,
      )
    },
    now: () => '2026-08-09T01:00:00.000Z',
  })

  return {
    schemaVersion: 1 as const,
    status: 'published' as const,
    identity: { targetVersion: '3.0.0' },
    artifact: { packageVersion: '3.0.0' },
    registryHealth,
  }
}

type PublishedInvestigationEvidence = Awaited<
  ReturnType<typeof createPublishedInvestigationEvidence>
>
type PublishedInstallInvestigationEvidence = Awaited<
  ReturnType<typeof createPublishedInstallInvestigationEvidence>
>

function createRetryFailure({
  stage = 'runtime',
  cause = new ReleaseVerificationPackageUserError('SVG is empty'),
  cleanConsumer = true,
}: {
  stage?: 'install' | 'build' | 'runtime'
  cause?: Error
  cleanConsumer?: boolean
} = {}) {
  const verification = Object.assign(structuredClone(createVerificationEvidence(false)), { cleanConsumer })
  return new RegistrySmokeVerificationFailure(stage, cause, verification)
}

describe('initial registry smoke health', () => {
  it('rejects a forged pending object before calling the verifier', async () => {
    const canonical = createRegistryHealth()
    const registryHealth = {
      ...canonical,
      package: { ...canonical.package },
      profile: {
        ...canonical.profile,
        requested: { ...canonical.profile.requested },
        resolved: { ...canonical.profile.resolved },
      },
      attempts: [],
    }
    const verifyRegistryPackage = vi.fn(async () => createVerificationEvidence(true))

    await expect(runInitialRegistrySmoke({
      registryHealth,
      verifyRegistryPackage,
      now: () => '2026-08-09T01:00:00.000Z',
    })).rejects.toThrow('Initial registry smoke requires pending registry health evidence')

    expect(verifyRegistryPackage).not.toHaveBeenCalled()
  })

  it('freezes factory pending evidence while keeping it usable', async () => {
    const registryHealth = createRegistryHealth()
    const verifyRegistryPackage = vi.fn(async () => createVerificationEvidence(true))

    expect(Object.isFrozen(registryHealth)).toBe(true)
    expect(Object.isFrozen(registryHealth.package)).toBe(true)
    expect(Object.isFrozen(registryHealth.profile)).toBe(true)
    expect(Object.isFrozen(registryHealth.profile.requested)).toBe(true)
    expect(Object.isFrozen(registryHealth.profile.resolved)).toBe(true)
    expect(Object.isFrozen(registryHealth.attempts)).toBe(true)
    expect(() => Object.assign(registryHealth, { status: 'investigation' })).toThrow(TypeError)

    await expect(runInitialRegistrySmoke({
      registryHealth,
      verifyRegistryPackage,
      now: () => '2026-08-09T01:00:00.000Z',
    })).resolves.toMatchObject({ status: 'healthy' })
  })

  it('records a successful clean attempt as healthy', async () => {
    const registryHealth = createRegistryHealth()
    const verification = createVerificationEvidence(true)
    const verifyRegistryPackage = vi.fn(async () => verification)

    await expect(runInitialRegistrySmoke({
      registryHealth,
      verifyRegistryPackage,
      now: () => '2026-08-09T01:00:00.000Z',
    })).resolves.toMatchObject({
      status: 'healthy',
      package: {
        name: '@barzhsieh/nuxt-content-mermaid',
        version: '3.0.0',
      },
      profile: {
        id: 'v3-known-latest',
        requested: {
          nuxt: '>=4.1.0 <5.0.0',
          nuxtContent: '>=3.5.0 <4.0.0',
        },
        resolved: frozenRegistryProfile.versions,
      },
      attempts: [{
        number: 1,
        completedAt: '2026-08-09T01:00:00.000Z',
        cleanConsumer: true,
        success: true,
        stage: null,
        classification: null,
        verification,
      }],
      retryCommand: null,
    })
    expect(verifyRegistryPackage).toHaveBeenCalledWith({
      packageName: '@barzhsieh/nuxt-content-mermaid',
      packageVersion: '3.0.0',
      profile: frozenRegistryProfile,
    })
    expect(verifyRegistryPackage).toHaveBeenCalledOnce()
  })

  it.each(invalidSuccessfulVerificationCases)(
    'rejects a resolved verifier value with %s as a contract error',
    async (_, mutateVerification) => {
      const verification = structuredClone(createVerificationEvidence(true))
      mutateVerification(verification)

      await expect(runInitialRegistrySmoke({
        registryHealth: createRegistryHealth(),
        verifyRegistryPackage: async () => verification,
        now: () => '2026-08-09T01:00:00.000Z',
      })).rejects.toBeInstanceOf(TypeError)
    },
  )

  it.each([
    [Object.assign(new Error('network unreachable'), { code: 'ENETUNREACH' }), 'network'],
    [new ReleaseVerificationPackageUserError('SVG is empty'), 'package-defect'],
  ])('records a first %s failure for investigation without throwing', async (cause, classification) => {
    const registryHealth = createRegistryHealth()
    const verification = createVerificationEvidence(false)
    const verifyRegistryPackage = vi.fn(async () => {
      throw new RegistrySmokeVerificationFailure('runtime', cause, verification)
    })

    await expect(runInitialRegistrySmoke({
      registryHealth,
      verifyRegistryPackage,
      now: () => '2026-08-09T01:00:00.000Z',
    })).resolves.toMatchObject({
      status: 'investigation',
      package: {
        name: '@barzhsieh/nuxt-content-mermaid',
        version: '3.0.0',
      },
      profile: {
        id: 'v3-known-latest',
        requested: {
          nuxt: '>=4.1.0 <5.0.0',
          nuxtContent: '>=3.5.0 <4.0.0',
        },
        resolved: frozenRegistryProfile.versions,
      },
      attempts: [{
        number: 1,
        completedAt: '2026-08-09T01:00:00.000Z',
        cleanConsumer: true,
        success: false,
        stage: 'runtime',
        classification,
        verification,
      }],
      retryCommand: 'pnpm release registry-smoke 3.0.0',
    })
  })
})

describe('registry smoke retry', () => {
  it('retries an install failure before resolved package and profile identity exist', async () => {
    const releaseEvidence = await createPublishedInstallInvestigationEvidence()
    const readEvidence = vi.fn(async () => structuredClone(releaseEvidence))
    const writeEvidence = vi.fn(async () => undefined)
    const successfulVerification = createVerificationEvidence(true)
    const verifyRegistryPackage = vi.fn(async () => successfulVerification)

    const result = await runRegistrySmokeRetry({
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
      readEvidence,
      writeEvidence,
      verifyRegistryPackage,
      now: () => '2026-08-09T02:00:00.000Z',
    })

    expect(verifyRegistryPackage).toHaveBeenCalledWith({
      packageName: '@barzhsieh/nuxt-content-mermaid',
      packageVersion: '3.0.0',
      profile: frozenRegistryProfile,
    })
    expect(result.registryHealth).toMatchObject({
      status: 'healthy',
      attempts: [
        {
          number: 1,
          success: false,
          stage: 'install',
          classification: 'registry',
          verification: {
            success: false,
            package: { resolvedVersion: null },
            profile: { resolved: null },
          },
        },
        { number: 2, success: true, verification: successfulVerification },
      ],
      retryCommand: null,
    })
    expect(writeEvidence).toHaveBeenCalledOnce()
    expect(writeEvidence).toHaveBeenCalledWith(result)
  })

  it.each([
    ['attempt success: true', (evidence: PublishedInstallInvestigationEvidence) => {
      evidence.registryHealth.attempts[0]!.success = true
    }],
    ['verification success: true', (evidence: PublishedInstallInvestigationEvidence) => {
      evidence.registryHealth.attempts[0]!.verification.success = true
    }],
  ])('rejects paired-null install evidence with %s before retry side effects', async (
    _,
    mutateEvidence,
  ) => {
    const releaseEvidence = await createPublishedInstallInvestigationEvidence()
    const readEvidence = vi.fn(async () => {
      const evidence = structuredClone(releaseEvidence)
      mutateEvidence(evidence)
      return evidence
    })
    const writeEvidence = vi.fn(async () => undefined)
    const verifyRegistryPackage = vi.fn(async () => createVerificationEvidence(true))

    await expect(runRegistrySmokeRetry({
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
      readEvidence,
      writeEvidence,
      verifyRegistryPackage,
      now: () => '2026-08-09T02:00:00.000Z',
    })).rejects.toBeInstanceOf(TypeError)

    expect(verifyRegistryPackage).not.toHaveBeenCalled()
    expect(writeEvidence).not.toHaveBeenCalled()
  })

  it('loads the frozen profile from the first investigation attempt', async () => {
    const releaseEvidence = await createPublishedInvestigationEvidence()
    const readEvidence = vi.fn(async () => structuredClone(releaseEvidence))
    const writeEvidence = vi.fn(async () => undefined)
    const successfulVerification = createVerificationEvidence(true)
    const verifyRegistryPackage = vi.fn(async () => successfulVerification)

    await runRegistrySmokeRetry({
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
      readEvidence,
      writeEvidence,
      verifyRegistryPackage,
      now: () => '2026-08-09T02:00:00.000Z',
    })

    expect(readEvidence).toHaveBeenCalledWith({
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
    })
    expect(verifyRegistryPackage).toHaveBeenCalledWith({
      packageName: '@barzhsieh/nuxt-content-mermaid',
      packageVersion: '3.0.0',
      profile: frozenRegistryProfile,
    })
    expect(writeEvidence).toHaveBeenCalledOnce()
    expect(writeEvidence).toHaveBeenCalledWith(expect.objectContaining({
      registryHealth: expect.objectContaining({
        status: 'healthy',
        attempts: expect.arrayContaining([
          expect.objectContaining({ number: 1 }),
          expect.objectContaining({ number: 2, success: true }),
        ]),
      }),
    }))
  })

  it.each(invalidSuccessfulVerificationCases)(
    'does not write a settled retry for a resolved verifier value with %s',
    async (_, mutateVerification) => {
      const releaseEvidence = await createPublishedInvestigationEvidence()
      const readEvidence = vi.fn(async () => structuredClone(releaseEvidence))
      const writeEvidence = vi.fn(async () => undefined)
      const verification = structuredClone(createVerificationEvidence(true))
      mutateVerification(verification)

      await expect(runRegistrySmokeRetry({
        repositoryRoot: '/repo',
        targetVersion: '3.0.0',
        readEvidence,
        writeEvidence,
        verifyRegistryPackage: async () => verification,
        now: () => '2026-08-09T02:00:00.000Z',
      })).rejects.toBeInstanceOf(TypeError)

      expect(writeEvidence).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['release identity target version', (evidence: PublishedInvestigationEvidence) => {
      evidence.identity.targetVersion = '3.0.1'
    }],
    ['artifact package version', (evidence: PublishedInvestigationEvidence) => {
      evidence.artifact.packageVersion = '3.0.1'
    }],
    ['registry health package version', (evidence: PublishedInvestigationEvidence) => {
      evidence.registryHealth.package.version = '3.0.1'
    }],
    ['first verification package name', (evidence: PublishedInvestigationEvidence) => {
      evidence.registryHealth.attempts[0]!.verification.package.name = '@example/wrong-package'
    }],
    ['first verification requested package version', (evidence: PublishedInvestigationEvidence) => {
      evidence.registryHealth.attempts[0]!.verification.package.requestedVersion = '3.0.1'
    }],
    ['first verification profile id', (evidence: PublishedInvestigationEvidence) => {
      evidence.registryHealth.attempts[0]!.verification.profile.id = 'wrong-profile'
    }],
    ['first verification requested profile', (evidence: PublishedInvestigationEvidence) => {
      const verification = evidence.registryHealth.attempts[0]!.verification
      verification.profile.requested = {
        ...verification.profile.requested,
        nuxt: '4.5.2',
      }
    }],
    ['frozen profile', (evidence: PublishedInvestigationEvidence) => {
      evidence.registryHealth.profile.resolved.nuxt = '4.5.2'
    }],
  ])('rejects an invalid %s before calling the verifier', async (_, mutateEvidence) => {
    const releaseEvidence = await createPublishedInvestigationEvidence()
    const readEvidence = vi.fn(async () => {
      const evidence = structuredClone(releaseEvidence)
      mutateEvidence(evidence)
      return evidence
    })
    const writeEvidence = vi.fn(async () => undefined)
    const verifyRegistryPackage = vi.fn(async () => createVerificationEvidence(true))

    await expect(runRegistrySmokeRetry({
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
      readEvidence,
      writeEvidence,
      verifyRegistryPackage,
      now: () => '2026-08-09T02:00:00.000Z',
    })).rejects.toThrow()

    expect(verifyRegistryPackage).not.toHaveBeenCalled()
    expect(writeEvidence).not.toHaveBeenCalled()
  })

  it('rejects a first attempt without an independent clean consumer', async () => {
    const releaseEvidence = await createPublishedInvestigationEvidence()
    const readEvidence = vi.fn(async () => {
      const evidence = structuredClone(releaseEvidence)
      evidence.registryHealth.attempts[0]!.cleanConsumer = false
      return evidence
    })
    const writeEvidence = vi.fn(async () => undefined)
    const verifyRegistryPackage = vi.fn(async () => createVerificationEvidence(true))

    await expect(runRegistrySmokeRetry({
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
      readEvidence,
      writeEvidence,
      verifyRegistryPackage,
      now: () => '2026-08-09T02:00:00.000Z',
    })).rejects.toThrow()

    expect(verifyRegistryPackage).not.toHaveBeenCalled()
    expect(writeEvidence).not.toHaveBeenCalled()
  })

  it.each([
    ['a non-published release', (evidence: PublishedInvestigationEvidence) => {
      ;(evidence as unknown as { status: string }).status = 'pushed'
    }],
    ['missing registry health', (evidence: PublishedInvestigationEvidence) => {
      delete (evidence as unknown as { registryHealth?: unknown }).registryHealth
    }],
    ['a non-investigation registry health state', (evidence: PublishedInvestigationEvidence) => {
      evidence.registryHealth.status = 'healthy'
    }],
    ['no first attempt', (evidence: PublishedInvestigationEvidence) => {
      evidence.registryHealth.attempts = []
    }],
    ['a first attempt numbered after one', (evidence: PublishedInvestigationEvidence) => {
      evidence.registryHealth.attempts[0]!.number = 2
    }],
    ['an incomplete frozen profile', (evidence: PublishedInvestigationEvidence) => {
      delete (evidence.registryHealth.profile.resolved as Partial<typeof frozenRegistryProfile.versions>).mermaid
    }],
    ['an empty requested Nuxt range', (evidence: PublishedInvestigationEvidence) => {
      evidence.registryHealth.profile.requested.nuxt = ''
    }],
    ['an empty requested Nuxt Content range', (evidence: PublishedInvestigationEvidence) => {
      evidence.registryHealth.profile.requested.nuxtContent = ''
    }],
  ])('rejects %s before calling the verifier', async (_, mutateEvidence) => {
    const releaseEvidence = await createPublishedInvestigationEvidence()
    const readEvidence = vi.fn(async () => {
      const evidence = structuredClone(releaseEvidence)
      mutateEvidence(evidence)
      return evidence
    })
    const writeEvidence = vi.fn(async () => undefined)
    const verifyRegistryPackage = vi.fn(async () => createVerificationEvidence(true))

    await expect(runRegistrySmokeRetry({
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
      readEvidence,
      writeEvidence,
      verifyRegistryPackage,
      now: () => '2026-08-09T02:00:00.000Z',
    })).rejects.toThrow()

    expect(verifyRegistryPackage).not.toHaveBeenCalled()
    expect(writeEvidence).not.toHaveBeenCalled()
  })

  it('accepts a persisted reader type while rejecting legacy evidence before side effects', async () => {
    const legacyEvidence: LeanReleaseEvidence = {
      schemaVersion: 1,
      status: 'published',
      changeHeadCommit: 'change-head-commit',
      sourceChecks: null,
      identity: {
        sourceCommit: 'prepared-release-commit',
        targetVersion: '3.0.0',
        artifactIntegritySha512: 'sha512-release-artifact',
      },
      artifact: {
        archivePath: '/repo/.release-evidence/3.0.0/package.tgz',
        filename: 'package.tgz',
        sha256: 'sha256-release-artifact',
        packageName: '@barzhsieh/nuxt-content-mermaid',
        packageVersion: '3.0.0',
        packlist: [],
      },
      releaseBaseline: null,
      compatibilityProfiles: [],
      manualCheck: null,
      timestamps: {},
    }
    const readEvidence = vi.fn(async (): Promise<LeanReleaseEvidence> => legacyEvidence)
    const writeEvidence = vi.fn(async () => undefined)
    const verifyRegistryPackage = vi.fn(async () => createVerificationEvidence(true))

    await expect(runRegistrySmokeRetry({
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
      readEvidence,
      writeEvidence,
      verifyRegistryPackage,
      now: () => '2026-08-09T02:00:00.000Z',
    })).rejects.toThrow('requires registry health')

    expect(verifyRegistryPackage).not.toHaveBeenCalled()
    expect(writeEvidence).not.toHaveBeenCalled()
  })

  it.each([
    [
      'the first classification',
      (evidence: PublishedInvestigationEvidence) => {
        evidence.registryHealth.attempts[0]!.classification = 'network'
      },
      createRetryFailure(),
    ],
    [
      'a network retry classification',
      () => {},
      createRetryFailure({ cause: Object.assign(new Error('network unavailable'), { code: 'ENETUNREACH' }) }),
    ],
    [
      'a registry retry classification',
      () => {},
      createRetryFailure({ cause: Object.assign(new Error('registry unavailable'), { code: 'E503' }) }),
    ],
    [
      'a runner retry classification',
      () => {},
      createRetryFailure({ cause: Object.assign(new Error('runner unavailable'), { code: 'ENOENT' }) }),
    ],
    [
      'a permission retry classification',
      () => {},
      createRetryFailure({ cause: Object.assign(new Error('permission denied'), { code: 'EACCES' }) }),
    ],
    [
      'the package-user stage',
      () => {},
      createRetryFailure({ stage: 'build' }),
    ],
    [
      'the retry clean-consumer evidence',
      () => {},
      createRetryFailure({ cleanConsumer: false }),
    ],
  ])('keeps investigation when %s does not confirm a package defect', async (
    _,
    mutateEvidence,
    retryFailure,
  ) => {
    const releaseEvidence = await createPublishedInvestigationEvidence()
    const readEvidence = vi.fn(async () => {
      const evidence = structuredClone(releaseEvidence)
      mutateEvidence(evidence)
      return evidence
    })
    const writeEvidence = vi.fn(async () => undefined)
    const verifyRegistryPackage = vi.fn(async () => {
      throw retryFailure
    })

    const result = await runRegistrySmokeRetry({
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
      readEvidence,
      writeEvidence,
      verifyRegistryPackage,
      now: () => '2026-08-09T02:00:00.000Z',
    })

    expect(result.registryHealth).toMatchObject({
      status: 'investigation',
      attempts: [
        { number: 1, cleanConsumer: true },
        { number: 2, success: false },
      ],
      retryCommand: 'pnpm release registry-smoke 3.0.0',
    })
    expect(writeEvidence).toHaveBeenCalledOnce()
    expect(writeEvidence).toHaveBeenCalledWith(result)
  })

  it('records two matching clean package defects as unhealthy', async () => {
    const releaseEvidence = await createPublishedInvestigationEvidence()
    const readEvidence = vi.fn(async () => structuredClone(releaseEvidence))
    const writeEvidence = vi.fn(async () => undefined)
    const verifyRegistryPackage = vi.fn(async () => {
      throw createRetryFailure()
    })

    const result = await runRegistrySmokeRetry({
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
      readEvidence,
      writeEvidence,
      verifyRegistryPackage,
      now: () => '2026-08-09T02:00:00.000Z',
    })

    expect(result.registryHealth).toMatchObject({
      status: 'unhealthy',
      attempts: [
        { number: 1, classification: 'package-defect', stage: 'runtime', cleanConsumer: true },
        { number: 2, classification: 'package-defect', stage: 'runtime', cleanConsumer: true },
      ],
    })
    expect(writeEvidence).toHaveBeenCalledOnce()
  })

  it.each([
    ['the retry package version', (failure: RegistrySmokeVerificationFailure) => {
      failure.evidence.package.resolvedVersion = '3.0.1'
    }],
    ['the retry frozen profile', (failure: RegistrySmokeVerificationFailure) => {
      failure.evidence.profile.resolved!.nuxt = '4.5.2'
    }],
  ])('keeps investigation when %s does not match the frozen request', async (_, mutateFailure) => {
    const releaseEvidence = await createPublishedInvestigationEvidence()
    const retryFailure = createRetryFailure()
    mutateFailure(retryFailure)
    const readEvidence = vi.fn(async () => structuredClone(releaseEvidence))
    const writeEvidence = vi.fn(async () => undefined)
    const verifyRegistryPackage = vi.fn(async () => {
      throw retryFailure
    })

    const result = await runRegistrySmokeRetry({
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
      readEvidence,
      writeEvidence,
      verifyRegistryPackage,
      now: () => '2026-08-09T02:00:00.000Z',
    })

    expect(result.registryHealth).toMatchObject({
      status: 'investigation',
      attempts: [{ number: 1 }, { number: 2, classification: 'package-defect' }],
      retryCommand: 'pnpm release registry-smoke 3.0.0',
    })
    expect(writeEvidence).toHaveBeenCalledOnce()
  })

  it('keeps investigation when a successful retry lacks clean-consumer evidence', async () => {
    const releaseEvidence = await createPublishedInvestigationEvidence()
    const readEvidence = vi.fn(async () => structuredClone(releaseEvidence))
    const writeEvidence = vi.fn(async () => undefined)
    const verifyRegistryPackage = vi.fn(async () => (
      Object.assign(createVerificationEvidence(true), { cleanConsumer: false })
    ))

    const result = await runRegistrySmokeRetry({
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
      readEvidence,
      writeEvidence,
      verifyRegistryPackage,
      now: () => '2026-08-09T02:00:00.000Z',
    })

    expect(result.registryHealth).toMatchObject({
      status: 'investigation',
      attempts: [{ number: 1 }, { number: 2, cleanConsumer: false, success: true }],
      retryCommand: 'pnpm release registry-smoke 3.0.0',
    })
    expect(writeEvidence).toHaveBeenCalledOnce()
  })
})
