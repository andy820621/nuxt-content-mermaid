import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  parseReleaseArguments,
  runReleaseCli,
  runReleaseGate,
  runReleaseReconciliation,
} from '../scripts/release-verification/release.mjs'
import { RegistrySmokeVerificationFailure } from '../scripts/release-verification/runner.mjs'
import * as releaseModule from '../scripts/release-verification/release.mjs'

function createInertEffects() {
  const evidenceSnapshots: unknown[] = []
  const externalCalls: string[] = []
  return {
    evidenceSnapshots,
    externalCalls,
    now: vi.fn(() => '2026-08-09T00:00:00.000Z'),
    readRepositoryState: vi.fn(async () => ({
      branch: 'main',
      clean: true,
      head: 'change-head-commit',
      packageName: '@barzhsieh/nuxt-content-mermaid',
      packageVersion: '2.2.3',
    })),
    readPublishedVersion: vi.fn(async (): Promise<string | null> => null),
    readRegistryRelease: vi.fn(),
    readEvidence: vi.fn(),
    runCommand: vi.fn(async () => ({ stdout: '', stderr: '' })),
    writeEvidence: vi.fn(async (evidence: unknown) => {
      evidenceSnapshots.push(structuredClone(evidence))
    }),
    prepareRelease: vi.fn(),
    resolveCompatibilityProfile: vi.fn(async () => compatibilityResolution),
    verifyArtifact: vi.fn(async () => ({ success: true })),
    runManualCheck: vi.fn(async (): Promise<Partial<Record<string, boolean>>> => manualResults),
    assertReleaseIdentity: vi.fn(async ({ phase }: { phase: string }) => {
      externalCalls.push(`assert:${phase}`)
    }),
    fastForward: vi.fn(async () => { externalCalls.push('fast-forward') }),
    createTag: vi.fn(async () => { externalCalls.push('tag') }),
    push: vi.fn(async () => { externalCalls.push('push') }),
    publish: vi.fn(async () => { externalCalls.push('publish') }),
    verifyRegistryPackage: vi.fn(async (request: {
      profile: typeof actualLatestProfile
    }) => {
      externalCalls.push('registry-smoke')
      return createRegistryVerificationEvidence(true, request.profile)
    }),
  }
}

const releaseRequest = {
  mode: 'release' as const,
  targetVersion: '3.0.0',
  skipManualReason: null,
}

const reconciliationRequest = {
  mode: 'reconcile' as const,
  targetVersion: '3.0.0',
}

const retainedArtifact = {
  archivePath: '/repo/.release-evidence/3.0.0/package.tgz',
  filename: 'package.tgz',
  sha256: 'sha256-diagnostic',
  integritySha512: 'sha512-cmVsZWFzZS1hcnRpZmFjdA==',
  packlist: ['dist/module.mjs', 'dist/types.d.mts', 'package.json'],
  packageName: '@barzhsieh/nuxt-content-mermaid',
  packageVersion: '3.0.0',
}

const actualLatestProfile = {
  id: 'nuxt-4-actual-latest-release',
  versions: {
    betterSqlite3: '12.11.1',
    nuxt: '4.99.0',
    nuxtContent: '3.99.0',
    mermaid: '11.12.3',
    typescript: '5.9.3',
    vueTsc: '3.2.5',
  },
}

const compatibilityResolution = {
  requested: {
    nuxt: '>=4.1.0 <5.0.0',
    nuxtContent: '>=3.5.0 <4.0.0',
  },
  resolved: actualLatestProfile.versions,
  profile: actualLatestProfile,
}

function createRegistryVerificationEvidence(
  success: boolean,
  profile = actualLatestProfile,
) {
  return {
    schemaVersion: 1 as const,
    success,
    mode: 'registry-smoke' as const,
    package: {
      name: retainedArtifact.packageName,
      requestedVersion: retainedArtifact.packageVersion,
      resolvedVersion: retainedArtifact.packageVersion,
    },
    profile: {
      id: profile.id,
      requested: profile.versions,
      resolved: profile.versions,
    },
    stages: [],
  }
}

function createPublishedInvestigationEvidence() {
  const frozenProfile = {
    ...actualLatestProfile,
    id: 'frozen-registry-evidence',
    versions: {
      ...actualLatestProfile.versions,
      nuxt: '4.8.0',
      nuxtContent: '3.8.0',
    },
  }
  const verification = createRegistryVerificationEvidence(false, frozenProfile)
  return {
    ...structuredClone(pushedEvidence),
    status: 'published',
    registryHealth: {
      status: 'investigation',
      package: {
        name: retainedArtifact.packageName,
        version: retainedArtifact.packageVersion,
      },
      profile: {
        id: frozenProfile.id,
        requested: compatibilityResolution.requested,
        resolved: frozenProfile.versions,
      },
      attempts: [{
        number: 1,
        completedAt: '2026-08-09T00:00:00.000Z',
        cleanConsumer: true,
        success: false,
        stage: 'runtime',
        classification: 'package-defect',
        verification,
      }],
      retryCommand: 'pnpm release registry-smoke 3.0.0',
    },
  }
}

function observeRegistryHealthLifecycle(effects: ReturnType<typeof createInertEffects>) {
  const lifecycle: string[] = []
  effects.writeEvidence.mockImplementation(async (evidence: unknown) => {
    effects.evidenceSnapshots.push(structuredClone(evidence))
    const snapshot = evidence as {
      registryHealth?: { status?: string }
      status?: string
    }
    lifecycle.push(
      `write:${snapshot.status}:${snapshot.registryHealth?.status ?? 'none'}`,
    )
  })
  effects.verifyRegistryPackage.mockImplementation(async (request) => {
    lifecycle.push('registry-smoke')
    return createRegistryVerificationEvidence(true, request.profile)
  })
  return lifecycle
}

const manualResults = {
  fullscreen: true,
  zoomPanDrag: true,
  clipboard: true,
  mobileInteraction: true,
  visualReadability: true,
}

const pushedEvidence = {
  schemaVersion: 1,
  status: 'pushed',
  changeHeadCommit: 'change-head-commit',
  sourceChecks: {
    command: 'pnpm verify:source',
    passed: true,
    completedAt: '2026-08-09T00:00:00.000Z',
  },
  identity: {
    sourceCommit: 'prepared-release-commit',
    targetVersion: '3.0.0',
    artifactIntegritySha512: retainedArtifact.integritySha512,
  },
  artifact: {
    archivePath: retainedArtifact.archivePath,
    filename: retainedArtifact.filename,
    packageName: retainedArtifact.packageName,
    packageVersion: retainedArtifact.packageVersion,
    packlist: retainedArtifact.packlist,
  },
  compatibilityProfile: {
    requested: compatibilityResolution.requested,
    resolved: compatibilityResolution.resolved,
    passed: true,
  },
  manualCheck: {
    required: false,
    reason: 'documentation-only release',
    results: null,
  },
  timestamps: {
    startedAt: '2026-08-09T00:00:00.000Z',
    pushedAt: '2026-08-09T00:00:00.000Z',
  },
}

interface PreflightOverride {
  branch?: string
  clean?: boolean
  packageVersion?: string
  publishedVersion?: string
}

describe('release gate CLI', () => {
  it('parses exact release and reconciliation requests', () => {
    expect(parseReleaseArguments(['3.0.0'])).toEqual({
      mode: 'release',
      targetVersion: '3.0.0',
      skipManualReason: null,
    })
    expect(parseReleaseArguments([
      '3.0.1',
      '--skip-manual',
      'documentation-only release',
    ])).toEqual({
      mode: 'release',
      targetVersion: '3.0.1',
      skipManualReason: 'documentation-only release',
    })
    expect(parseReleaseArguments(['reconcile', '3.0.0'])).toEqual({
      mode: 'reconcile',
      targetVersion: '3.0.0',
    })
  })

  it('parses a registry-smoke retry for one exact version', () => {
    expect(parseReleaseArguments(['registry-smoke', '3.0.0'])).toEqual({
      mode: 'registry-smoke-retry',
      targetVersion: '3.0.0',
    })
  })

  it.each([
    [['registry-smoke']],
    [['registry-smoke', 'latest']],
    [['registry-smoke', 'v3.0.0']],
    [['registry-smoke', '^3.0.0']],
    [['registry-smoke', '3.0.0', '--clean']],
  ])('rejects an invalid registry-smoke request: %j', (argv) => {
    expect(() => parseReleaseArguments(argv)).toThrow()
  })

  it.each([
    [[]],
    [['patch']],
    [['v3.0.0']],
    [['3.0']],
    [['03.0.0']],
    [['3.0.0-01']],
    [['reconcile']],
  ])('rejects a request without an exact target SemVer: %j', (argv) => {
    expect(() => parseReleaseArguments(argv)).toThrow('exact target SemVer')
  })

  it.each([
    [['3.0.0', '--skip-manual'], 'non-empty reason'],
    [['3.0.0', '--skip-manual', '   '], 'non-empty reason'],
    [['3.0.0', '--unknown'], 'Unknown release option'],
    [['reconcile', '3.0.0', '--skip-manual', 'not applicable'], 'does not accept options'],
  ])('rejects an ambiguous release request: %j', (argv, message) => {
    expect(() => parseReleaseArguments(argv)).toThrow(message)
  })
})

describe('release repository integration', () => {
  it('defines one source-verification command and one release entrypoint', async () => {
    const repositoryRoot = process.cwd()
    const manifest = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
    const workflow = await readFile(join(repositoryRoot, '.github/workflows/ci.yml'), 'utf8')
    const gitignore = await readFile(join(repositoryRoot, '.gitignore'), 'utf8')

    expect(manifest.scripts['verify:source'])
      .toBe('pnpm lint && pnpm test && pnpm test:types')
    expect(manifest.scripts.release)
      .toBe('node scripts/release-verification/release.mjs')
    expect(Object.keys(manifest.scripts).filter(key => key.startsWith('release:'))).toEqual([])
    expect(workflow).toContain('run: pnpm verify:source')

    const matrixJobStart = workflow.indexOf('  representative-compatibility-matrix:')
    const nextJobStart = workflow.indexOf('  module-compatibility:')

    expect(matrixJobStart).toBeGreaterThan(-1)
    expect(nextJobStart).toBeGreaterThan(matrixJobStart)

    const matrixJob = workflow.slice(matrixJobStart, nextJobStart)
    const matrixInstall = matrixJob.indexOf('run: npx nypm@latest i')
    const matrixPrepare = matrixJob.indexOf('run: npm run dev:prepare')
    const matrixVerification = matrixJob.indexOf('run: npm run test:compatibility-matrix')

    expect(matrixInstall).toBeGreaterThan(-1)
    expect(matrixPrepare).toBeGreaterThan(-1)
    expect(matrixVerification).toBeGreaterThan(-1)
    expect(matrixPrepare).toBeGreaterThan(matrixInstall)
    expect(matrixVerification).toBeGreaterThan(matrixPrepare)
    expect(gitignore.split(/\r?\n/)).toContain('.release-evidence')
  })
})

describe('release gate preflight', () => {
  it.each<[PreflightOverride, string]>([
    [{ branch: 'feature' }, 'formal main branch'],
    [{ clean: false }, 'clean worktree'],
    [{ packageVersion: '3.0.0' }, 'newer than current version'],
    [{ publishedVersion: '3.0.0' }, 'already exists in the registry'],
  ])('blocks before source verification when %j', async (stateOverride, message) => {
    const effects = createInertEffects()
    const { publishedVersion, ...repositoryOverride } = stateOverride
    effects.readRepositoryState.mockResolvedValueOnce({
      branch: 'main',
      clean: true,
      head: 'change-head-commit',
      packageName: '@barzhsieh/nuxt-content-mermaid',
      packageVersion: '2.2.3',
      ...repositoryOverride,
    })
    effects.readPublishedVersion.mockResolvedValueOnce(publishedVersion ?? null)
    await expect(runReleaseGate({
      request: releaseRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })).rejects.toThrow(message)

    expect(effects.runCommand).not.toHaveBeenCalled()
    expect(effects.prepareRelease).not.toHaveBeenCalled()
    expect(effects.createTag).not.toHaveBeenCalled()
    expect(effects.push).not.toHaveBeenCalled()
    expect(effects.publish).not.toHaveBeenCalled()
  })

  it.each([
    ['3.0.0-beta.1', '3.0.0-beta.2'],
    ['3.0.0-beta.2', '3.0.0-beta.10'],
    ['3.0.0-rc.1', '3.0.0'],
  ])('accepts a higher exact SemVer from %s to %s', async (currentVersion, targetVersion) => {
    const effects = createInertEffects()
    effects.readRepositoryState.mockResolvedValueOnce({
      branch: 'main',
      clean: true,
      head: 'change-head-commit',
      packageName: '@barzhsieh/nuxt-content-mermaid',
      packageVersion: currentVersion,
    })
    effects.runCommand.mockRejectedValueOnce(new Error('stop after preflight'))

    await expect(runReleaseGate({
      request: { ...releaseRequest, targetVersion },
      repositoryRoot: '/repo',
      effects: effects as never,
    })).rejects.toThrow('source verification')

    expect(effects.runCommand).toHaveBeenCalledOnce()
  })

  it.each([
    ['nonzero', new Error('source checks exited with code 2')],
    ['indeterminate', undefined],
  ])('blocks external effects when source verification is %s', async (_label, result) => {
    const effects = createInertEffects()
    if (result instanceof Error) {
      effects.runCommand.mockRejectedValueOnce(result)
    }
    else {
      effects.runCommand.mockResolvedValueOnce(result as never)
    }

    await expect(runReleaseGate({
      request: releaseRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })).rejects.toThrow('source verification')

    expect(effects.runCommand).toHaveBeenCalledWith({
      command: 'pnpm',
      args: ['verify:source'],
      cwd: '/repo',
    })
    expect(effects.writeEvidence).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'blocked',
      changeHeadCommit: 'change-head-commit',
      sourceChecks: {
        command: 'pnpm verify:source',
        passed: false,
        completedAt: '2026-08-09T00:00:00.000Z',
      },
      identity: null,
    }))
    expect(effects.prepareRelease).not.toHaveBeenCalled()
    expect(effects.createTag).not.toHaveBeenCalled()
    expect(effects.push).not.toHaveBeenCalled()
    expect(effects.publish).not.toHaveBeenCalled()
  })

  it('records the prepared commit and retained archive as the release identity', async () => {
    const effects = createInertEffects()
    effects.prepareRelease.mockResolvedValueOnce({
      sourceCommit: 'prepared-release-commit',
      artifact: retainedArtifact,
    })

    const evidence = await runReleaseGate({
      request: releaseRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })

    expect(effects.prepareRelease).toHaveBeenCalledOnce()
    expect(effects.prepareRelease).toHaveBeenCalledWith({
      changeHeadCommit: 'change-head-commit',
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
    })
    expect(evidence).toMatchObject({
      identity: {
        sourceCommit: 'prepared-release-commit',
        targetVersion: '3.0.0',
        artifactIntegritySha512: retainedArtifact.integritySha512,
      },
      artifact: {
        archivePath: retainedArtifact.archivePath,
        filename: retainedArtifact.filename,
        packageName: retainedArtifact.packageName,
        packageVersion: retainedArtifact.packageVersion,
        packlist: retainedArtifact.packlist,
      },
    })
    expect(effects.writeEvidence).toHaveBeenLastCalledWith(evidence)
  })

  it.each([
    [{ sourceCommit: '', artifact: retainedArtifact }, 'prepared source commit'],
    [{
      sourceCommit: 'prepared-release-commit',
      artifact: { ...retainedArtifact, packageVersion: '2.2.3' },
    }, 'tarball version'],
    [{
      sourceCommit: 'prepared-release-commit',
      artifact: { ...retainedArtifact, integritySha512: 'sha256-not-release-identity' },
    }, 'SHA-512 integrity'],
  ])('blocks an invalid prepared release identity: %s', async (prepared, message) => {
    const effects = createInertEffects()
    effects.prepareRelease.mockResolvedValueOnce(prepared)

    await expect(runReleaseGate({
      request: releaseRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })).rejects.toThrow(message)

    expect(effects.writeEvidence).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'blocked',
    }))
    expect(effects.createTag).not.toHaveBeenCalled()
    expect(effects.push).not.toHaveBeenCalled()
    expect(effects.publish).not.toHaveBeenCalled()
  })

  it('verifies the retained artifact with one actual-latest release profile', async () => {
    const effects = createInertEffects()
    effects.prepareRelease.mockResolvedValueOnce({
      sourceCommit: 'prepared-release-commit',
      artifact: retainedArtifact,
    })
    effects.resolveCompatibilityProfile.mockResolvedValueOnce(compatibilityResolution)
    effects.verifyArtifact.mockResolvedValueOnce({ success: true })

    const evidence = await runReleaseGate({
      request: releaseRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })

    expect(effects.resolveCompatibilityProfile).toHaveBeenCalledOnce()
    expect(effects.verifyArtifact).toHaveBeenCalledWith({
      artifact: retainedArtifact,
      profile: actualLatestProfile,
    })
    expect(evidence).toMatchObject({
      compatibilityProfile: {
        id: actualLatestProfile.id,
        requested: compatibilityResolution.requested,
        resolved: compatibilityResolution.resolved,
        passed: true,
      },
      identity: {
        artifactIntegritySha512: retainedArtifact.integritySha512,
      },
    })
    expect(effects.writeEvidence).toHaveBeenLastCalledWith(evidence)
  })

  it.each([
    ['failed', new Error('basic SVG check failed')],
    ['indeterminate', undefined],
  ])('blocks publication when retained artifact verification is %s', async (_label, result) => {
    const effects = createInertEffects()
    effects.prepareRelease.mockResolvedValueOnce({
      sourceCommit: 'prepared-release-commit',
      artifact: retainedArtifact,
    })
    if (result instanceof Error) {
      effects.verifyArtifact.mockRejectedValueOnce(result)
    }
    else {
      effects.verifyArtifact.mockResolvedValueOnce(result as never)
    }

    await expect(runReleaseGate({
      request: releaseRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })).rejects.toThrow('artifact verification')

    expect(effects.writeEvidence).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'blocked',
      compatibilityProfile: {
        id: actualLatestProfile.id,
        requested: compatibilityResolution.requested,
        resolved: compatibilityResolution.resolved,
        passed: false,
      },
    }))
    expect(effects.createTag).not.toHaveBeenCalled()
    expect(effects.push).not.toHaveBeenCalled()
    expect(effects.publish).not.toHaveBeenCalled()
  })

  it('requires every manual interaction check against the retained artifact by default', async () => {
    const effects = createInertEffects()
    effects.prepareRelease.mockResolvedValueOnce({
      sourceCommit: 'prepared-release-commit',
      artifact: retainedArtifact,
    })

    const evidence = await runReleaseGate({
      request: releaseRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })

    expect(effects.runManualCheck).toHaveBeenCalledWith({
      artifact: retainedArtifact,
      profile: actualLatestProfile,
      checks: [
        'fullscreen',
        'zoomPanDrag',
        'clipboard',
        'mobileInteraction',
        'visualReadability',
      ],
    })
    expect(evidence).toMatchObject({
      manualCheck: {
        required: true,
        reason: 'required by default',
        results: manualResults,
      },
    })
    expect(effects.evidenceSnapshots).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'verified' }),
    ]))
  })

  it('records an explicit manual skip reason without starting a manual consumer', async () => {
    const effects = createInertEffects()
    effects.prepareRelease.mockResolvedValueOnce({
      sourceCommit: 'prepared-release-commit',
      artifact: retainedArtifact,
    })

    const evidence = await runReleaseGate({
      request: {
        ...releaseRequest,
        skipManualReason: 'documentation-only release',
      },
      repositoryRoot: '/repo',
      effects: effects as never,
    })

    expect(effects.runManualCheck).not.toHaveBeenCalled()
    expect(evidence).toMatchObject({
      manualCheck: {
        required: false,
        reason: 'documentation-only release',
        results: null,
      },
    })
    expect(effects.evidenceSnapshots).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'verified' }),
    ]))
  })

  it.each([
    ['failed', { ...manualResults, clipboard: false }],
    ['incomplete', {
      fullscreen: true,
      zoomPanDrag: true,
      clipboard: true,
      mobileInteraction: true,
    }],
    ['errored', new Error('manual consumer failed to start')],
  ])('blocks publication when manual verification is %s', async (_label, result) => {
    const effects = createInertEffects()
    effects.prepareRelease.mockResolvedValueOnce({
      sourceCommit: 'prepared-release-commit',
      artifact: retainedArtifact,
    })
    if (result instanceof Error) {
      effects.runManualCheck.mockRejectedValueOnce(result)
    }
    else {
      effects.runManualCheck.mockResolvedValueOnce(result)
    }

    await expect(runReleaseGate({
      request: releaseRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })).rejects.toThrow('manual verification')

    expect(effects.writeEvidence).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'blocked',
      manualCheck: expect.objectContaining({
        required: true,
        reason: 'required by default',
      }),
    }))
    expect(effects.createTag).not.toHaveBeenCalled()
    expect(effects.push).not.toHaveBeenCalled()
    expect(effects.publish).not.toHaveBeenCalled()
  })

  it('revalidates identity before each ordered publication effect', async () => {
    const effects = createInertEffects()
    effects.prepareRelease.mockResolvedValueOnce({
      sourceCommit: 'prepared-release-commit',
      artifact: retainedArtifact,
    })

    const evidence = await runReleaseGate({
      request: releaseRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })

    expect(effects.externalCalls).toEqual([
      'assert:fast-forward',
      'fast-forward',
      'assert:tag',
      'tag',
      'assert:push',
      'push',
      'assert:publish',
      'publish',
      'registry-smoke',
    ])
    const publicationIdentity = {
      sourceCommit: 'prepared-release-commit',
      targetVersion: '3.0.0',
      artifactIntegritySha512: retainedArtifact.integritySha512,
    }
    expect(effects.assertReleaseIdentity).toHaveBeenNthCalledWith(1, {
      phase: 'fast-forward',
      repositoryRoot: '/repo',
      changeHeadCommit: 'change-head-commit',
      identity: publicationIdentity,
      artifact: retainedArtifact,
      tagName: 'v3.0.0',
    })
    expect(effects.fastForward).toHaveBeenCalledWith({
      repositoryRoot: '/repo',
      sourceCommit: 'prepared-release-commit',
    })
    expect(effects.createTag).toHaveBeenCalledWith({
      repositoryRoot: '/repo',
      sourceCommit: 'prepared-release-commit',
      tagName: 'v3.0.0',
    })
    expect(effects.push).toHaveBeenCalledWith({
      branch: 'main',
      repositoryRoot: '/repo',
      tagName: 'v3.0.0',
    })
    expect(effects.publish).toHaveBeenCalledWith({
      archivePath: retainedArtifact.archivePath,
      distTag: 'latest',
    })
    expect(effects.verifyRegistryPackage).toHaveBeenCalledWith({
      packageName: retainedArtifact.packageName,
      packageVersion: releaseRequest.targetVersion,
      profile: actualLatestProfile,
    })
    expect(evidence).toMatchObject({
      status: 'published',
      registryHealth: { status: 'healthy' },
    })
    expect(effects.evidenceSnapshots).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'pushed' }),
      expect.objectContaining({ status: 'published' }),
    ]))
    const publishedSnapshots = effects.evidenceSnapshots.filter(snapshot => (
      (snapshot as { status?: string }).status === 'published'
    )) as Array<{ registryHealth?: { status: string } }>
    expect(publishedSnapshots).toHaveLength(3)
    expect(publishedSnapshots[0]).not.toHaveProperty('registryHealth')
    expect(publishedSnapshots[1]).toMatchObject({ registryHealth: { status: 'pending' } })
    expect(publishedSnapshots[2]).toMatchObject({ registryHealth: { status: 'healthy' } })
  })

  it('keeps a published release orthogonal to a first registry-smoke failure', async () => {
    const effects = createInertEffects()
    effects.prepareRelease.mockResolvedValueOnce({
      sourceCommit: 'prepared-release-commit',
      artifact: retainedArtifact,
    })
    effects.verifyRegistryPackage.mockRejectedValueOnce(
      new RegistrySmokeVerificationFailure(
        'runtime',
        Object.assign(new Error('rendered SVG is empty'), { code: 'PACKAGE_DEFECT' }),
        createRegistryVerificationEvidence(false),
      ),
    )

    const evidence = await runReleaseGate({
      request: releaseRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })

    expect(evidence).toMatchObject({
      status: 'published',
      registryHealth: {
        status: 'investigation',
        retryCommand: 'pnpm release registry-smoke 3.0.0',
      },
    })
    expect(effects.publish).toHaveBeenCalledOnce()
    expect(effects).not.toHaveProperty('deprecate')
    expect(effects).not.toHaveProperty('promote')
    expect(effects).not.toHaveProperty('patch')
    expect(effects).not.toHaveProperty('unpublish')
    expect(effects).not.toHaveProperty('rollback')
  })

  it('blocks before mutating the formal branch when publication identity is invalid', async () => {
    const effects = createInertEffects()
    effects.prepareRelease.mockResolvedValueOnce({
      sourceCommit: 'prepared-release-commit',
      artifact: retainedArtifact,
    })
    effects.assertReleaseIdentity.mockRejectedValueOnce(
      new Error('formal package version does not match target'),
    )

    await expect(runReleaseGate({
      request: releaseRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })).rejects.toThrow('publication identity')

    expect(effects.writeEvidence).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'blocked',
      blocked: expect.objectContaining({ stage: 'publication-identity' }),
    }))
    expect(effects.fastForward).not.toHaveBeenCalled()
    expect(effects.createTag).not.toHaveBeenCalled()
    expect(effects.push).not.toHaveBeenCalled()
    expect(effects.publish).not.toHaveBeenCalled()
  })
})

describe('release publication reconciliation', () => {
  it('accepts valid old evidence without registry health', async () => {
    const effects = createInertEffects()
    effects.readEvidence.mockResolvedValueOnce(structuredClone(pushedEvidence))
    effects.readRegistryRelease.mockResolvedValueOnce({
      state: 'published',
      integrity: retainedArtifact.integritySha512,
    })

    await expect(runReleaseReconciliation({
      request: reconciliationRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })).resolves.toMatchObject({
      status: 'published',
      registryHealth: {
        status: 'healthy',
        profile: { id: 'nuxt-4-actual-latest-release' },
      },
    })
  })

  it('allows reconciliation only after the original push may have succeeded', async () => {
    const effects = createInertEffects()
    effects.readEvidence.mockResolvedValueOnce({
      ...structuredClone(pushedEvidence),
      status: 'verified',
      timestamps: {
        startedAt: '2026-08-09T00:00:00.000Z',
      },
    })

    await expect(runReleaseReconciliation({
      request: reconciliationRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })).rejects.toThrow('only available after push')

    expect(effects.assertReleaseIdentity).not.toHaveBeenCalled()
    expect(effects.readRegistryRelease).not.toHaveBeenCalled()
    expect(effects.publish).not.toHaveBeenCalled()
  })

  it('retries publication with the retained tarball when the version is absent', async () => {
    const effects = createInertEffects()
    const lifecycle = observeRegistryHealthLifecycle(effects)
    effects.readEvidence.mockResolvedValueOnce(structuredClone(pushedEvidence))
    effects.readRegistryRelease.mockResolvedValueOnce({ state: 'absent' })

    const evidence = await runReleaseReconciliation({
      request: reconciliationRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })

    expect(effects.assertReleaseIdentity).toHaveBeenCalledWith({
      phase: 'reconcile',
      repositoryRoot: '/repo',
      changeHeadCommit: 'change-head-commit',
      identity: pushedEvidence.identity,
      artifact: expect.objectContaining({
        archivePath: retainedArtifact.archivePath,
        integritySha512: retainedArtifact.integritySha512,
      }),
      tagName: 'v3.0.0',
    })
    expect(effects.assertReleaseIdentity).toHaveBeenCalledTimes(2)
    expect(effects.publish).toHaveBeenCalledOnce()
    expect(effects.publish).toHaveBeenCalledWith({
      archivePath: retainedArtifact.archivePath,
      distTag: 'latest',
    })
    expect(evidence).toMatchObject({
      status: 'published',
      registryHealth: {
        status: 'healthy',
        attempts: [{ number: 1 }],
      },
    })
    expect(effects.verifyRegistryPackage).toHaveBeenCalledOnce()
    expect(effects.verifyRegistryPackage).toHaveBeenCalledWith({
      packageName: retainedArtifact.packageName,
      packageVersion: reconciliationRequest.targetVersion,
      profile: actualLatestProfile,
    })
    expect(lifecycle).toEqual([
      'write:published:none',
      'write:published:pending',
      'registry-smoke',
      'write:published:healthy',
    ])
    expect(effects.evidenceSnapshots).toHaveLength(3)
    expect(effects.evidenceSnapshots[0]).not.toHaveProperty('registryHealth')
    expect(effects.evidenceSnapshots[1]).toMatchObject({
      status: 'published',
      registryHealth: { status: 'pending' },
    })
    expect(effects.evidenceSnapshots[2]).toMatchObject({
      status: 'published',
      registryHealth: { status: 'healthy' },
    })
  })

  it('accepts an already-published version only when registry integrity matches', async () => {
    const effects = createInertEffects()
    const lifecycle = observeRegistryHealthLifecycle(effects)
    effects.readEvidence.mockResolvedValueOnce(structuredClone(pushedEvidence))
    effects.readRegistryRelease.mockResolvedValueOnce({
      state: 'published',
      integrity: retainedArtifact.integritySha512,
    })

    const evidence = await runReleaseReconciliation({
      request: reconciliationRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })

    expect(effects.publish).not.toHaveBeenCalled()
    expect(evidence).toMatchObject({
      status: 'published',
      registryHealth: {
        status: 'healthy',
        attempts: [{ number: 1 }],
      },
    })
    expect(effects.verifyRegistryPackage).toHaveBeenCalledOnce()
    expect(effects.verifyRegistryPackage).toHaveBeenCalledWith({
      packageName: retainedArtifact.packageName,
      packageVersion: reconciliationRequest.targetVersion,
      profile: actualLatestProfile,
    })
    expect(lifecycle).toEqual([
      'write:published:none',
      'write:published:pending',
      'registry-smoke',
      'write:published:healthy',
    ])
    expect(effects.evidenceSnapshots).toHaveLength(3)
    expect(effects.evidenceSnapshots[0]).not.toHaveProperty('registryHealth')
    expect(effects.evidenceSnapshots[1]).toMatchObject({
      status: 'published',
      registryHealth: { status: 'pending' },
    })
    expect(effects.evidenceSnapshots[2]).toMatchObject({
      status: 'published',
      registryHealth: { status: 'healthy' },
    })
    expect(effects.writeEvidence).toHaveBeenLastCalledWith(evidence)
  })

  it.each(['absent', 'throws'])(
    'treats existing registry health as a true reconciliation no-op when registry query %s',
    async (registryOutcome) => {
      const effects = createInertEffects()
      const evidenceWithRegistryHealth = createPublishedInvestigationEvidence()
      const originalEvidence = structuredClone(evidenceWithRegistryHealth)
      effects.readEvidence.mockResolvedValueOnce(evidenceWithRegistryHealth)
      if (registryOutcome === 'absent') {
        effects.readRegistryRelease.mockResolvedValueOnce({ state: 'absent' })
      }
      else {
        effects.readRegistryRelease.mockRejectedValueOnce(new Error('registry unavailable'))
      }

      const evidence = await runReleaseReconciliation({
        request: reconciliationRequest,
        repositoryRoot: '/repo',
        effects: effects as never,
      })

      expect(evidence).toBe(evidenceWithRegistryHealth)
      expect(evidence).toEqual(originalEvidence)
      expect(effects.assertReleaseIdentity).not.toHaveBeenCalled()
      expect(effects.readRegistryRelease).not.toHaveBeenCalled()
      expect(effects.verifyRegistryPackage).not.toHaveBeenCalled()
      expect(effects.publish).not.toHaveBeenCalled()
      expect(effects.writeEvidence).not.toHaveBeenCalled()
    },
  )

  it('keeps pushed evidence when reconciliation publication remains ambiguous', async () => {
    const effects = createInertEffects()
    effects.readEvidence.mockResolvedValueOnce(structuredClone(pushedEvidence))
    effects.readRegistryRelease.mockResolvedValueOnce({ state: 'absent' })
    effects.publish.mockRejectedValueOnce(new Error('registry connection closed'))

    await expect(runReleaseReconciliation({
      request: reconciliationRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })).rejects.toThrow('reconciliation publish')

    expect(effects.writeEvidence).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'pushed',
      blocked: expect.objectContaining({ stage: 'reconciliation-publish' }),
    }))
  })

  it('fails fatally when the published version has different integrity', async () => {
    const effects = createInertEffects()
    effects.readEvidence.mockResolvedValueOnce(structuredClone(pushedEvidence))
    effects.readRegistryRelease.mockResolvedValueOnce({
      state: 'published',
      integrity: 'sha512-ZGlmZmVyZW50LWFydGlmYWN0',
    })

    await expect(runReleaseReconciliation({
      request: reconciliationRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })).rejects.toThrow('artifact conflict')

    expect(effects.publish).not.toHaveBeenCalled()
    expect(effects.writeEvidence).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'blocked',
      blocked: expect.objectContaining({
        stage: 'registry-integrity-conflict',
      }),
    }))
  })

  it.each([
    ['failed', new Error('registry timeout')],
    ['indeterminate', undefined],
  ])('remains blocked when the reconciliation registry query is %s', async (_label, result) => {
    const effects = createInertEffects()
    effects.readEvidence.mockResolvedValueOnce(structuredClone(pushedEvidence))
    if (result instanceof Error) {
      effects.readRegistryRelease.mockRejectedValueOnce(result)
    }
    else {
      effects.readRegistryRelease.mockResolvedValueOnce(result as never)
    }

    await expect(runReleaseReconciliation({
      request: reconciliationRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })).rejects.toThrow('registry query')

    expect(effects.publish).not.toHaveBeenCalled()
    expect(effects.writeEvidence).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'blocked',
      blocked: expect.objectContaining({ stage: 'registry-query' }),
    }))
  })

  it('revalidates Git, tag, manifest, archive, and integrity before registry lookup', async () => {
    const effects = createInertEffects()
    effects.readEvidence.mockResolvedValueOnce(structuredClone(pushedEvidence))
    effects.assertReleaseIdentity.mockRejectedValueOnce(
      new Error('retained tarball integrity mismatch'),
    )

    await expect(runReleaseReconciliation({
      request: reconciliationRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })).rejects.toThrow('reconciliation identity')

    expect(effects.readRegistryRelease).not.toHaveBeenCalled()
    expect(effects.publish).not.toHaveBeenCalled()
    expect(effects.writeEvidence).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'blocked',
      blocked: expect.objectContaining({ stage: 'reconciliation-identity' }),
    }))
  })
})

describe('production release effects', () => {
  it('resolves a Nuxt 3 actual-latest profile for compatibility drift', async () => {
    const commandRunner = vi.fn(async ({ command, args }: {
      command: string
      args: string[]
    }) => {
      expect(command).toBe('npm')
      if (args[1] === 'nuxt@>=3.20.1 <4.0.0') {
        return { stdout: JSON.stringify(['3.21.0', '3.22.1']) }
      }
      if (args[1] === '@nuxt/content@>=3.5.0 <4.0.0') {
        return { stdout: JSON.stringify(['3.15.2', '3.16.0']) }
      }
      throw new Error(`Unexpected registry query: ${args[1]}`)
    })
    const createReleaseEffects = (releaseModule as unknown as {
      createReleaseEffects: (options: unknown) => {
        resolveCompatibilityProfile: (input: unknown) => Promise<unknown>
      }
    }).createReleaseEffects
    const effects = createReleaseEffects({ commandRunner, repositoryRoot: '/repo' })

    await expect(effects.resolveCompatibilityProfile({
      nuxtMajor: 3,
      profileId: 'nuxt-3-actual-latest-drift',
    })).resolves.toEqual({
      requested: {
        nuxt: '>=3.20.1 <4.0.0',
        nuxtContent: '>=3.5.0 <4.0.0',
      },
      resolved: {
        betterSqlite3: '12.11.1',
        mermaid: '11.12.3',
        nuxt: '3.22.1',
        nuxtContent: '3.16.0',
        typescript: '5.9.3',
        vueTsc: '3.2.5',
      },
      profile: {
        id: 'nuxt-3-actual-latest-drift',
        versions: {
          betterSqlite3: '12.11.1',
          mermaid: '11.12.3',
          nuxt: '3.22.1',
          nuxtContent: '3.16.0',
          typescript: '5.9.3',
          vueTsc: '3.2.5',
        },
      },
    })
  })

  it('prepares one local release commit and retains the single packed artifact', async () => {
    const commands: string[] = []
    const commandRunner = vi.fn(async ({ command, args, cwd }: {
      command: string
      args: string[]
      cwd: string
    }) => {
      commands.push(`${cwd}: ${[command, ...args].join(' ')}`)
      if (command === 'git' && args.join(' ') === 'rev-parse HEAD') {
        return { stdout: 'prepared-release-commit\n' }
      }
      return { stdout: '' }
    })
    const artifactCreator = vi.fn(async () => ({
      ...retainedArtifact,
      archivePath: '/repo/.release-evidence/3.0.0/pack/package.tgz',
    }))
    const filesystem = {
      mkdir: vi.fn(async () => undefined),
      mkdtemp: vi.fn(async () => '/tmp/release-prep-abc'),
      rename: vi.fn(async () => undefined),
      rm: vi.fn(async () => undefined),
    }
    const createReleaseEffects = (releaseModule as unknown as {
      createReleaseEffects: (options: unknown) => {
        prepareRelease: (input: unknown) => Promise<unknown>
      }
    }).createReleaseEffects
    const effects = createReleaseEffects({
      artifactCreator,
      commandRunner,
      filesystem,
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
      temporaryRoot: '/tmp',
    })

    await expect(effects.prepareRelease({
      changeHeadCommit: 'change-head-commit',
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
    })).resolves.toEqual({
      sourceCommit: 'prepared-release-commit',
      artifact: retainedArtifact,
    })
    expect(commands).toEqual([
      '/repo: git worktree add -b release-prep/v3.0.0-release-prep-abc /tmp/release-prep-abc/worktree change-head-commit',
      '/tmp/release-prep-abc/worktree: /repo/node_modules/.bin/changelogen --release -r 3.0.0 --no-commit --no-tag',
      '/tmp/release-prep-abc/worktree: pnpm install --lockfile-only --ignore-scripts',
      '/tmp/release-prep-abc/worktree: git add -A',
      '/tmp/release-prep-abc/worktree: git commit -m chore(release): v3.0.0',
      '/tmp/release-prep-abc/worktree: git rev-parse HEAD',
      '/tmp/release-prep-abc/worktree: pnpm install --frozen-lockfile --ignore-scripts',
      '/repo: git worktree remove --force /tmp/release-prep-abc/worktree',
    ])
    expect(artifactCreator).toHaveBeenCalledOnce()
    expect(artifactCreator).toHaveBeenCalledWith({
      artifactDirectory: '/repo/.release-evidence/3.0.0/pack',
      repositoryRoot: '/tmp/release-prep-abc/worktree',
    })
    expect(filesystem.rename).toHaveBeenCalledWith(
      '/repo/.release-evidence/3.0.0/pack/package.tgz',
      retainedArtifact.archivePath,
    )
    expect(filesystem.rm).toHaveBeenCalledWith(
      '/repo/.release-evidence/3.0.0/pack',
      { recursive: true, force: true },
    )
  })

  it('revalidates the formal commit, tag, manifest, and retained archive integrity', async () => {
    const archiveBytes = Buffer.from('retained release artifact')
    const integritySha512 = `sha512-${createHash('sha512').update(archiveBytes).digest('base64')}`
    const commandRunner = vi.fn(async ({ command, args }: {
      command: string
      args: string[]
    }) => {
      const invocation = [command, ...args].join(' ')
      const results: Record<string, string> = {
        'git branch --show-current': 'main\n',
        'git status --porcelain=v1 --untracked-files=all': '',
        'git rev-parse HEAD': 'prepared-release-commit\n',
        'git rev-list -n 1 v3.0.0': 'prepared-release-commit\n',
        'tar -xOf /repo/.release-evidence/3.0.0/package.tgz package/package.json': JSON.stringify({
          name: '@barzhsieh/nuxt-content-mermaid',
          version: '3.0.0',
        }),
      }
      if (!(invocation in results)) throw new Error(`Unexpected command: ${invocation}`)
      return { stdout: results[invocation] }
    })
    const filesystem = {
      readFile: vi.fn(async (path: string) => {
        if (path === '/repo/package.json') {
          return JSON.stringify({
            name: '@barzhsieh/nuxt-content-mermaid',
            version: '3.0.0',
          })
        }
        if (path === retainedArtifact.archivePath) return archiveBytes
        throw new Error(`Unexpected file: ${path}`)
      }),
    }
    const createReleaseEffects = (releaseModule as unknown as {
      createReleaseEffects: (options: unknown) => {
        assertReleaseIdentity: (input: unknown) => Promise<void>
      }
    }).createReleaseEffects
    const effects = createReleaseEffects({ commandRunner, filesystem, repositoryRoot: '/repo' })
    const artifact = { ...retainedArtifact, integritySha512 }

    await expect(effects.assertReleaseIdentity({
      phase: 'publish',
      repositoryRoot: '/repo',
      changeHeadCommit: 'change-head-commit',
      identity: {
        sourceCommit: 'prepared-release-commit',
        targetVersion: '3.0.0',
        artifactIntegritySha512: integritySha512,
      },
      artifact,
      tagName: 'v3.0.0',
    })).resolves.toBeUndefined()

    await expect(effects.assertReleaseIdentity({
      phase: 'publish',
      repositoryRoot: '/repo',
      changeHeadCommit: 'change-head-commit',
      identity: {
        sourceCommit: 'prepared-release-commit',
        targetVersion: '3.0.0',
        artifactIntegritySha512: 'sha512-different',
      },
      artifact,
      tagName: 'v3.0.0',
    })).rejects.toThrow('integrity')
  })

  it('adopts the prepared commit with a local fast-forward only', async () => {
    const commandRunner = vi.fn(async () => ({ stdout: '' }))
    const createReleaseEffects = (releaseModule as unknown as {
      createReleaseEffects: (options: unknown) => {
        fastForward: (input: unknown) => Promise<void>
      }
    }).createReleaseEffects
    const effects = createReleaseEffects({ commandRunner, repositoryRoot: '/repo' })

    await effects.fastForward({
      repositoryRoot: '/repo',
      sourceCommit: 'prepared-release-commit',
    })

    expect(commandRunner).toHaveBeenCalledWith({
      command: 'git',
      args: ['merge', '--ff-only', 'prepared-release-commit'],
      cwd: '/repo',
    })
  })

  it('maps tag, push, and publish to explicit commands without rebuilding', async () => {
    const commandRunner = vi.fn(async (_invocation: unknown) => ({ stdout: '', stderr: '' }))
    const createReleaseEffects = (releaseModule as unknown as {
      createReleaseEffects: (options: unknown) => {
        createTag: (input: unknown) => Promise<void>
        push: (input: unknown) => Promise<void>
        publish: (input: unknown) => Promise<void>
      }
    }).createReleaseEffects
    const effects = createReleaseEffects({ commandRunner, repositoryRoot: '/repo' })

    await effects.createTag({
      repositoryRoot: '/repo',
      sourceCommit: 'prepared-release-commit',
      tagName: 'v3.0.0',
    })
    await effects.push({
      branch: 'main',
      repositoryRoot: '/repo',
      tagName: 'v3.0.0',
    })
    await effects.publish({
      archivePath: '/repo/.release-evidence/3.0.0/package.tgz',
      distTag: 'latest',
    })

    expect(commandRunner.mock.calls.map(([invocation]) => invocation)).toEqual([
      {
        command: 'git',
        args: ['tag', '-a', 'v3.0.0', 'prepared-release-commit', '-m', 'v3.0.0'],
        cwd: '/repo',
      },
      {
        command: 'git',
        args: ['push', '--atomic', 'origin', 'main', 'v3.0.0'],
        cwd: '/repo',
      },
      {
        command: 'npm',
        args: [
          'publish',
          '/repo/.release-evidence/3.0.0/package.tgz',
          '--tag',
          'latest',
          '--ignore-scripts',
        ],
        cwd: '/repo',
      },
    ])
    expect(commandRunner.mock.calls.flat().join(' ')).not.toMatch(/\b(?:build|pack|prepack|prepare)\b/)
  })

  it('reads formal repository state and exact registry version presence', async () => {
    const commandRunner = vi.fn(async ({ command, args }: {
      command: string
      args: string[]
    }) => {
      const invocation = [command, ...args].join(' ')
      if (invocation === 'git branch --show-current') return { stdout: 'main\n' }
      if (invocation === 'git status --porcelain=v1 --untracked-files=all') return { stdout: '' }
      if (invocation === 'git rev-parse HEAD') return { stdout: 'change-head-commit\n' }
      if (invocation === 'npm view @barzhsieh/nuxt-content-mermaid versions --json') {
        return { stdout: JSON.stringify(['2.2.3', '3.0.0']) }
      }
      if (invocation === 'npm view @barzhsieh/nuxt-content-mermaid@3.0.0 dist.integrity --json') {
        return { stdout: JSON.stringify(retainedArtifact.integritySha512) }
      }
      throw new Error(`Unexpected command: ${invocation}`)
    })
    const readFile = vi.fn(async () => JSON.stringify({
      name: '@barzhsieh/nuxt-content-mermaid',
      version: '2.2.3',
    }))
    const createReleaseEffects = (releaseModule as unknown as {
      createReleaseEffects: (options: unknown) => {
        readRepositoryState: (input: unknown) => Promise<unknown>
        readPublishedVersion: (input: unknown) => Promise<unknown>
        readRegistryRelease: (input: unknown) => Promise<unknown>
      }
    }).createReleaseEffects
    const effects = createReleaseEffects({
      commandRunner,
      filesystem: { readFile },
      repositoryRoot: '/repo',
    })

    await expect(effects.readRepositoryState({ repositoryRoot: '/repo' })).resolves.toEqual({
      branch: 'main',
      clean: true,
      head: 'change-head-commit',
      packageName: '@barzhsieh/nuxt-content-mermaid',
      packageVersion: '2.2.3',
    })
    await expect(effects.readPublishedVersion({
      packageName: '@barzhsieh/nuxt-content-mermaid',
      targetVersion: '3.0.0',
    })).resolves.toBe('3.0.0')
    await expect(effects.readPublishedVersion({
      packageName: '@barzhsieh/nuxt-content-mermaid',
      targetVersion: '3.0.1',
    })).resolves.toBeNull()
    await expect(effects.readRegistryRelease({
      packageName: '@barzhsieh/nuxt-content-mermaid',
      targetVersion: '3.0.0',
    })).resolves.toEqual({
      state: 'published',
      integrity: retainedArtifact.integritySha512,
    })
    await expect(effects.readRegistryRelease({
      packageName: '@barzhsieh/nuxt-content-mermaid',
      targetVersion: '3.0.1',
    })).resolves.toEqual({ state: 'absent' })
  })

  it('writes and reads the local evidence journal under the exact target version', async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), 'release-evidence-test-'))
    try {
      const createReleaseEffects = (releaseModule as unknown as {
        createReleaseEffects: (options: unknown) => {
          writeEvidence: (evidence: unknown) => Promise<void>
          readEvidence: (input: unknown) => Promise<unknown>
        }
      }).createReleaseEffects
      const effects = createReleaseEffects({
        repositoryRoot,
        targetVersion: '3.0.0',
      })
      const evidence = structuredClone(pushedEvidence)

      await effects.writeEvidence(evidence)

      const evidencePath = join(
        repositoryRoot,
        '.release-evidence',
        '3.0.0',
        'release.json',
      )
      await expect(readFile(evidencePath, 'utf8'))
        .resolves.toBe(`${JSON.stringify(evidence, null, 2)}\n`)
      await expect(effects.readEvidence({
        repositoryRoot,
        targetVersion: '3.0.0',
      })).resolves.toEqual(evidence)
    }
    finally {
      await rm(repositoryRoot, { recursive: true, force: true })
    }
  })

  it('resolves one actual-latest profile and verifies the retained artifact', async () => {
    const commandRunner = vi.fn(async ({ command, args }: {
      command: string
      args: string[]
    }) => {
      const invocation = [command, ...args].join(' ')
      if (invocation === 'npm view nuxt@>=4.1.0 <5.0.0 version --json') {
        return { stdout: JSON.stringify(['4.9.0', '4.10.0']) }
      }
      if (invocation === 'npm view @nuxt/content@>=3.5.0 <4.0.0 version --json') {
        return { stdout: JSON.stringify(['3.9.0', '3.15.2']) }
      }
      throw new Error(`Unexpected command: ${invocation}`)
    })
    const artifactVerifier = vi.fn(async () => ({ success: true }))
    const verificationOperations = { seam: 'clean-package-user-consumer' }
    const createReleaseEffects = (releaseModule as unknown as {
      createReleaseEffects: (options: unknown) => {
        resolveCompatibilityProfile: () => Promise<unknown>
        verifyArtifact: (input: unknown) => Promise<unknown>
      }
    }).createReleaseEffects
    const effects = createReleaseEffects({
      artifactVerifier,
      commandRunner,
      repositoryRoot: '/repo',
      verificationOperations,
    })

    const resolution = await effects.resolveCompatibilityProfile() as {
      requested: Record<string, string>
      resolved: typeof actualLatestProfile.versions
      profile: typeof actualLatestProfile
    }
    expect(resolution).toEqual({
      requested: compatibilityResolution.requested,
      resolved: {
        ...actualLatestProfile.versions,
        nuxt: '4.10.0',
        nuxtContent: '3.15.2',
      },
      profile: {
        id: 'nuxt-4-actual-latest-release',
        versions: {
          ...actualLatestProfile.versions,
          nuxt: '4.10.0',
          nuxtContent: '3.15.2',
        },
      },
    })

    await expect(effects.verifyArtifact({
      artifact: retainedArtifact,
      profile: resolution.profile,
    })).resolves.toEqual({ success: true })
    expect(artifactVerifier).toHaveBeenCalledWith({
      packageSource: {
        kind: 'retained',
        artifact: retainedArtifact,
      },
      profile: resolution.profile,
    }, verificationOperations)
  })

  it('injects registry verification through the shared verification operations', async () => {
    const verification = createRegistryVerificationEvidence(true)
    const registryVerifier = vi.fn(async () => verification)
    const verificationOperations = { seam: 'registry-package-user-consumer' }
    const createReleaseEffects = (releaseModule as unknown as {
      createReleaseEffects: (options: unknown) => {
        verifyRegistryPackage: (input: unknown) => Promise<unknown>
      }
    }).createReleaseEffects
    const effects = createReleaseEffects({
      commandRunner: vi.fn(),
      registryVerifier,
      repositoryRoot: '/repo',
      verificationOperations,
    })
    const request = {
      packageName: retainedArtifact.packageName,
      packageVersion: retainedArtifact.packageVersion,
      profile: actualLatestProfile,
    }

    await expect(effects.verifyRegistryPackage(request)).resolves.toBe(verification)
    expect(registryVerifier).toHaveBeenCalledWith(request, verificationOperations)
  })

  it('runs manual checks in a second clean consumer built from the retained artifact', async () => {
    const verificationOperations = {
      createWorkspace: vi.fn(async () => ({
        root: '/tmp/manual-consumer-root',
        consumerDirectory: '/tmp/manual-consumer-root/consumer',
      })),
      installConsumer: vi.fn(async () => ({
        packageVersion: retainedArtifact.packageVersion,
        profileVersions: actualLatestProfile.versions,
      })),
      buildConsumer: vi.fn(async () => undefined),
      cleanupWorkspace: vi.fn(async () => undefined),
    }
    const manualInteractionRunner = vi.fn(async () => manualResults)
    const createReleaseEffects = (releaseModule as unknown as {
      createReleaseEffects: (options: unknown) => {
        runManualCheck: (input: unknown) => Promise<unknown>
      }
    }).createReleaseEffects
    const effects = createReleaseEffects({
      commandRunner: vi.fn(),
      manualInteractionRunner,
      repositoryRoot: '/repo',
      verificationOperations,
    })
    const checks = Object.keys(manualResults)

    await expect(effects.runManualCheck({
      artifact: retainedArtifact,
      profile: actualLatestProfile,
      checks,
    })).resolves.toEqual(manualResults)
    expect(verificationOperations.installConsumer).toHaveBeenCalledWith({
      packageSource: { kind: 'artifact', artifact: retainedArtifact },
      consumerDirectory: '/tmp/manual-consumer-root/consumer',
      profile: actualLatestProfile,
    })
    expect(verificationOperations.buildConsumer).toHaveBeenCalledWith({
      consumerDirectory: '/tmp/manual-consumer-root/consumer',
    })
    expect(manualInteractionRunner).toHaveBeenCalledWith({
      checks,
      consumerDirectory: '/tmp/manual-consumer-root/consumer',
    })
    expect(verificationOperations.cleanupWorkspace).toHaveBeenCalledWith(
      '/tmp/manual-consumer-root',
    )
  })

  it('dispatches the narrow reconciliation command through one inert effects object', async () => {
    const effects = createInertEffects()
    effects.readEvidence.mockResolvedValueOnce(structuredClone(pushedEvidence))
    effects.readRegistryRelease.mockResolvedValueOnce({
      state: 'published',
      integrity: retainedArtifact.integritySha512,
    })
    const effectFactory = vi.fn(() => effects)
    await expect(runReleaseCli({
      argv: ['reconcile', '3.0.0'],
      effectFactory: effectFactory as never,
      repositoryRoot: '/repo',
    })).resolves.toMatchObject({ status: 'published' })
    expect(effectFactory).toHaveBeenCalledWith({
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
    })
    expect(effects.publish).not.toHaveBeenCalled()
  })

  it('dispatches registry-smoke retry from frozen evidence without release effects', async () => {
    const effects = createInertEffects()
    const evidence = createPublishedInvestigationEvidence()
    effects.readEvidence.mockResolvedValueOnce(structuredClone(evidence))
    effects.verifyRegistryPackage.mockImplementationOnce(async request => (
      createRegistryVerificationEvidence(true, request.profile)
    ))
    const effectFactory = vi.fn(() => effects)
    await expect(runReleaseCli({
      argv: ['registry-smoke', '3.0.0'],
      effectFactory: effectFactory as never,
      repositoryRoot: '/repo',
    })).resolves.toMatchObject({
      status: 'published',
      registryHealth: {
        status: 'healthy',
        attempts: [{ number: 1 }, { number: 2 }],
      },
    })
    expect(effects.readEvidence).toHaveBeenCalledWith({
      repositoryRoot: '/repo',
      targetVersion: '3.0.0',
    })
    expect(effects.verifyRegistryPackage).toHaveBeenCalledWith({
      packageName: retainedArtifact.packageName,
      packageVersion: '3.0.0',
      profile: {
        id: 'frozen-registry-evidence',
        versions: {
          ...actualLatestProfile.versions,
          nuxt: '4.8.0',
          nuxtContent: '3.8.0',
        },
      },
    })
    expect(effects.resolveCompatibilityProfile).not.toHaveBeenCalled()
    expect(effects.readPublishedVersion).not.toHaveBeenCalled()
    expect(effects.readRegistryRelease).not.toHaveBeenCalled()
    expect(effects.prepareRelease).not.toHaveBeenCalled()
    expect(effects.publish).not.toHaveBeenCalled()
  })

  it('reads the exact registry-smoke evidence path through production effects', async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), 'registry-smoke-cli-test-'))
    try {
      const createReleaseEffects = (releaseModule as unknown as {
        createReleaseEffects: (options: unknown) => {
          writeEvidence: (evidence: unknown) => Promise<void>
        }
      }).createReleaseEffects
      const readEvidenceFile = vi.fn(readFile)
      const commandRunner = vi.fn()
      const registryVerifier = vi.fn(async (request: {
        profile: typeof actualLatestProfile
      }) => createRegistryVerificationEvidence(true, request.profile))
      const effectOptions = {
        commandRunner,
        filesystem: { readFile: readEvidenceFile },
        registryVerifier,
        repositoryRoot,
        targetVersion: '3.0.0',
        verificationOperations: {},
      }
      const initialEffects = createReleaseEffects(effectOptions)
      await initialEffects.writeEvidence(createPublishedInvestigationEvidence())
      const effectFactory = vi.fn(() => createReleaseEffects(effectOptions))
      await expect(runReleaseCli({
        argv: ['registry-smoke', '3.0.0'],
        effectFactory: effectFactory as never,
        repositoryRoot,
      })).resolves.toMatchObject({
        status: 'published',
        registryHealth: { status: 'healthy' },
      })
      expect(readEvidenceFile).toHaveBeenCalledWith(join(
        repositoryRoot,
        '.release-evidence',
        '3.0.0',
        'release.json',
      ), 'utf8')
      expect(commandRunner).not.toHaveBeenCalled()
    }
    finally {
      await rm(repositoryRoot, { recursive: true, force: true })
    }
  })
})
