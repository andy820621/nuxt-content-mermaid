import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import {
  parseReleaseArguments,
  runReleaseCli,
  runReleaseGate,
  runReleaseReconciliation,
} from '../scripts/release-verification/release.mjs'
import {
  CompatibilityMatrixVerificationFailure,
  RegistrySmokeVerificationFailure,
} from '../scripts/release-verification/runner.mjs'
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
    readRegistryRelease: vi.fn(async (): Promise<
      { state: 'absent' } | { state: 'published', integrity: string }
    > => ({
      state: 'published' as const,
      integrity: retainedArtifact.integritySha512,
    })),
    readEvidence: vi.fn(),
    runCommand: vi.fn(async () => ({ stdout: '', stderr: '' })),
    initializeEvidence: vi.fn(async (evidence: unknown) => {
      evidenceSnapshots.push(structuredClone(evidence))
    }),
    writeEvidence: vi.fn(async (evidence: unknown) => {
      evidenceSnapshots.push(structuredClone(evidence))
    }),
    prepareRelease: vi.fn(),
    readReleaseManifestSnapshot: vi.fn(async () => releaseManifestSnapshot),
    verifyArtifactProfiles: vi.fn(async () => compatibilityMatrixEvidence),
    runManualCheck: vi.fn(async (): Promise<Partial<Record<string, boolean>>> => manualResults),
    assertReleaseIdentity: vi.fn(async ({ phase }: { phase: string }) => {
      externalCalls.push(`assert:${phase}`)
    }),
    fastForward: vi.fn(async () => { externalCalls.push('fast-forward') }),
    createTag: vi.fn(async () => { externalCalls.push('tag') }),
    push: vi.fn(async () => { externalCalls.push('push') }),
    publish: vi.fn(async () => { externalCalls.push('publish') }),
    verifyRegistryPackage: vi.fn(async (request: {
      profile: typeof knownLatestReleaseProfile
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
  sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  integritySha512: 'sha512-cmVsZWFzZS1hcnRpZmFjdA==',
  packlist: ['dist/module.mjs', 'dist/types.d.mts', 'package.json'],
  packageName: '@barzhsieh/nuxt-content-mermaid',
  packageVersion: '3.0.0',
}

const minimumReleaseProfile = {
  id: 'v3-minimum',
  nodeVersion: '22.19.0',
  versions: {
    betterSqlite3: '12.11.1',
    nuxt: '4.1.0',
    nuxtContent: '3.5.0',
    mermaid: '11.16.1',
    typescript: '5.9.3',
    vueTsc: '3.2.5',
  },
  expectedResolutions: {
    nuxtKit: '4.5.2',
    nuxtSchema: '4.5.2',
  },
}

const knownLatestReleaseProfile = {
  id: 'v3-known-latest',
  nodeVersion: '24.19.0',
  versions: {
    betterSqlite3: '12.11.1',
    nuxt: '4.5.2',
    nuxtContent: '3.15.2',
    mermaid: '11.16.1',
    typescript: '5.9.3',
    vueTsc: '3.2.5',
  },
  expectedResolutions: {
    nuxtKit: '4.5.2',
    nuxtSchema: '4.5.2',
  },
}

const releaseManifestSnapshot = {
  engines: { node: '>=22.19.0' },
  peerDependencies: {
    '@nuxt/content': '>=3.5.0 <4.0.0',
    'nuxt': '^4.1.0',
  },
  dependencies: {
    '@nuxt/kit': '^4.5.2',
    'mermaid': '~11.16.1',
  },
}

function createCompatibilityProfileEvidence(profile: typeof minimumReleaseProfile) {
  return {
    id: profile.id,
    success: true,
    requested: profile.versions,
    resolved: profile.versions,
    expectedResolutions: {
      requested: profile.expectedResolutions,
      resolved: profile.expectedResolutions,
    },
    runtime: {
      requested: profile.nodeVersion,
      observed: profile.nodeVersion,
    },
    stages: [],
  }
}

const compatibilityMatrixEvidence = {
  schemaVersion: 1 as const,
  success: true,
  mode: 'package-artifact-matrix' as const,
  package: {
    name: retainedArtifact.packageName,
    version: retainedArtifact.packageVersion,
  },
  artifact: {
    filename: retainedArtifact.filename,
    sha256: retainedArtifact.sha256,
  },
  profiles: [
    createCompatibilityProfileEvidence(minimumReleaseProfile),
    createCompatibilityProfileEvidence(knownLatestReleaseProfile),
  ],
  stages: [],
}

function createArtifactProfileEvidence(profile: typeof minimumReleaseProfile) {
  return {
    schemaVersion: 1,
    success: true,
    mode: 'package-artifact',
    package: compatibilityMatrixEvidence.package,
    artifact: compatibilityMatrixEvidence.artifact,
    profile: {
      id: profile.id,
      requested: profile.versions,
      resolved: profile.versions,
      expectedResolutions: {
        requested: profile.expectedResolutions,
        resolved: profile.expectedResolutions,
      },
    },
    runtime: {
      requested: profile.nodeVersion,
      observed: profile.nodeVersion,
    },
    stages: [],
  }
}

function createRegistryVerificationEvidence(
  success: boolean,
  profile = knownLatestReleaseProfile,
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
      expectedResolutions: {
        requested: profile.expectedResolutions,
        resolved: profile.expectedResolutions,
      },
    },
    runtime: {
      requested: profile.nodeVersion,
      observed: process.versions.node,
    },
    stages: [],
  }
}

function createPublishedInvestigationEvidence() {
  const frozenProfile = {
    ...knownLatestReleaseProfile,
    id: 'frozen-registry-evidence',
    versions: {
      ...knownLatestReleaseProfile.versions,
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
        nodeVersion: frozenProfile.nodeVersion,
        requested: {
          nuxt: frozenProfile.versions.nuxt,
          nuxtContent: frozenProfile.versions.nuxtContent,
        },
        resolved: frozenProfile.versions,
        expectedResolutions: frozenProfile.expectedResolutions,
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
    sha256: retainedArtifact.sha256,
    packageName: retainedArtifact.packageName,
    packageVersion: retainedArtifact.packageVersion,
    packlist: retainedArtifact.packlist,
  },
  releaseBaseline: {
    manifest: releaseManifestSnapshot,
    profiles: [minimumReleaseProfile, knownLatestReleaseProfile],
  },
  compatibilityProfiles: compatibilityMatrixEvidence.profiles,
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
    const domainContext = await readFile(join(repositoryRoot, 'CONTEXT.md'), 'utf8')

    expect(manifest.scripts['verify:source'])
      .toBe('pnpm lint && pnpm test && pnpm test:types')
    expect(manifest.scripts.release)
      .toBe('node scripts/release-verification/release.mjs')
    expect(manifest.scripts['test:compatibility-profile'])
      .toBe('node scripts/release-verification/package-artifact.mjs --package-source pack')
    expect(manifest.scripts['test:package-artifact'])
      .toBe('node scripts/release-verification/package-artifact.mjs --package-source pack --profile v3-known-latest')
    expect(manifest.scripts['test:compatibility-matrix']).toBeUndefined()
    expect(manifest.scripts['test:compatibility-drift']).toBeUndefined()
    expect(domainContext).not.toContain('Compatibility Drift Check')
    expect(Object.keys(manifest.scripts).filter(key => key.startsWith('release:'))).toEqual([])
    const parsedWorkflow = parse(workflow)
    const sourceJob = parsedWorkflow.jobs['source-verification']
    const parsedFinalJob = parsedWorkflow.jobs['final-compatibility-profiles']

    expect(Object.keys(parsedWorkflow.jobs)).toEqual([
      'source-verification',
      'final-compatibility-profiles',
    ])
    expect(sourceJob.steps).toContainEqual({
      uses: 'actions/setup-node@v6',
      with: { 'node-version': '24.19.0' },
    })
    expect(sourceJob.steps).toContainEqual({
      name: 'Verify source',
      run: 'pnpm verify:source',
    })

    expect(parsedFinalJob.strategy).toMatchObject({
      'fail-fast': false,
      'matrix': {
        include: [
          { 'profile': 'v3-minimum', 'node-version': '22.19.0' },
          { 'profile': 'v3-known-latest', 'node-version': '24.19.0' },
        ],
      },
    })
    expect(parsedFinalJob.steps).toContainEqual({
      uses: 'actions/setup-node@v6',
      with: { 'node-version': '${{ matrix.node-version }}' },
    })
    const finalCommands = parsedFinalJob.steps
      .map((step: { run?: string }) => step.run)
      .filter(Boolean)
    const finalInstall = finalCommands.indexOf('npx nypm@latest i')
    const finalPrepare = finalCommands.indexOf('npm run dev:prepare')
    const finalBrowserInstall = finalCommands.indexOf('npx playwright install')
    const finalVerification = finalCommands.indexOf(
      'npm run test:compatibility-profile -- --profile ${{ matrix.profile }}',
    )

    expect(finalInstall).toBeGreaterThan(-1)
    expect(finalPrepare).toBeGreaterThan(finalInstall)
    expect(finalBrowserInstall).toBeGreaterThan(finalPrepare)
    expect(finalVerification).toBeGreaterThan(finalBrowserInstall)
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
        sha256: retainedArtifact.sha256,
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
    [{
      sourceCommit: 'prepared-release-commit',
      artifact: { ...retainedArtifact, sha256: 'invalid-sha256' },
    }, 'SHA-256 digest'],
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

  it('freezes the retained artifact and both fixed profiles before child verification', async () => {
    const effects = createInertEffects()
    const lifecycle: string[] = []
    effects.prepareRelease.mockImplementationOnce(async () => {
      lifecycle.push('pack')
      return {
        sourceCommit: 'prepared-release-commit',
        artifact: retainedArtifact,
      }
    })
    effects.writeEvidence.mockImplementation(async (evidence: unknown) => {
      effects.evidenceSnapshots.push(structuredClone(evidence))
      if ((evidence as { releaseBaseline?: unknown }).releaseBaseline) {
        lifecycle.push('freeze')
      }
    })
    effects.verifyArtifactProfiles.mockImplementationOnce(async () => {
      lifecycle.push('verify')
      return compatibilityMatrixEvidence
    })

    const evidence = await runReleaseGate({
      request: releaseRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })

    expect(lifecycle.slice(0, 3)).toEqual(['pack', 'freeze', 'verify'])
    expect(effects.readReleaseManifestSnapshot).toHaveBeenCalledWith({
      artifact: retainedArtifact,
    })
    expect(effects.verifyArtifactProfiles).toHaveBeenCalledWith({
      artifact: retainedArtifact,
      profiles: [minimumReleaseProfile, knownLatestReleaseProfile],
    })
    expect(evidence).toMatchObject({
      releaseBaseline: {
        manifest: releaseManifestSnapshot,
        profiles: [minimumReleaseProfile, knownLatestReleaseProfile],
      },
      compatibilityProfiles: compatibilityMatrixEvidence.profiles,
      identity: {
        sourceCommit: 'prepared-release-commit',
        artifactIntegritySha512: retainedArtifact.integritySha512,
      },
    })
  })

  it.each([
    ['failed', new CompatibilityMatrixVerificationFailure(
      [{ profileId: minimumReleaseProfile.id, stage: 'runtime', cause: new Error('basic SVG check failed') }],
      {
        ...compatibilityMatrixEvidence,
        success: false,
        profiles: [{
          ...createCompatibilityProfileEvidence(minimumReleaseProfile),
          success: false,
        }],
      },
    )],
    ['indeterminate', undefined],
  ])('blocks publication when retained artifact verification is %s', async (_label, result) => {
    const effects = createInertEffects()
    effects.prepareRelease.mockResolvedValueOnce({
      sourceCommit: 'prepared-release-commit',
      artifact: retainedArtifact,
    })
    if (result instanceof Error) {
      effects.verifyArtifactProfiles.mockRejectedValueOnce(result)
    }
    else {
      effects.verifyArtifactProfiles.mockResolvedValueOnce(result as never)
    }

    await expect(runReleaseGate({
      request: releaseRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })).rejects.toThrow('artifact verification')

    expect(effects.writeEvidence).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'blocked',
      compatibilityProfiles: result instanceof CompatibilityMatrixVerificationFailure
        ? result.evidence.profiles
        : [],
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
      profile: knownLatestReleaseProfile,
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
      releaseBaseline: {
        manifest: releaseManifestSnapshot,
        profiles: [minimumReleaseProfile, knownLatestReleaseProfile],
      },
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
      profile: knownLatestReleaseProfile,
    })
    expect(effects.readRegistryRelease).toHaveBeenCalledWith({
      packageName: retainedArtifact.packageName,
      targetVersion: releaseRequest.targetVersion,
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

  it('refuses registry smoke when npm integrity differs from the frozen artifact', async () => {
    const effects = createInertEffects()
    effects.prepareRelease.mockResolvedValueOnce({
      sourceCommit: 'prepared-release-commit',
      artifact: retainedArtifact,
    })
    effects.readRegistryRelease.mockResolvedValueOnce({
      state: 'published',
      integrity: 'sha512-different-registry-artifact',
    })

    await expect(runReleaseGate({
      request: releaseRequest,
      repositoryRoot: '/repo',
      effects: effects as never,
    })).rejects.toThrow('frozen artifact identity')

    expect(effects.publish).toHaveBeenCalledOnce()
    expect(effects.verifyRegistryPackage).not.toHaveBeenCalled()
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
  it('accepts valid frozen evidence without registry health', async () => {
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
        profile: { id: 'v3-known-latest' },
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
      releaseBaseline: pushedEvidence.releaseBaseline,
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
      profile: knownLatestReleaseProfile,
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
      profile: knownLatestReleaseProfile,
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
    const sha256 = createHash('sha256').update(archiveBytes).digest('hex')
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
          ...releaseManifestSnapshot,
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
    const artifact = { ...retainedArtifact, integritySha512, sha256 }

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
      releaseBaseline: pushedEvidence.releaseBaseline,
      tagName: 'v3.0.0',
    })).resolves.toBeUndefined()

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
      releaseBaseline: {
        ...pushedEvidence.releaseBaseline,
        manifest: {
          ...releaseManifestSnapshot,
          dependencies: {
            ...releaseManifestSnapshot.dependencies,
            mermaid: '~11.99.0',
          },
        },
      },
      tagName: 'v3.0.0',
    })).rejects.toThrow('manifest changed')

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
      releaseBaseline: {
        ...pushedEvidence.releaseBaseline,
        profiles: [{
          ...minimumReleaseProfile,
          nodeVersion: '22.20.0',
        }, knownLatestReleaseProfile],
      },
      tagName: 'v3.0.0',
    })).rejects.toThrow('Compatibility Profiles changed')

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
      releaseBaseline: pushedEvidence.releaseBaseline,
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

  it('initializes one evidence directory and refuses to overwrite it', async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), 'release-evidence-test-'))
    try {
      const createReleaseEffects = (releaseModule as unknown as {
        createReleaseEffects: (options: unknown) => {
          initializeEvidence: (evidence: unknown) => Promise<void>
          writeEvidence: (evidence: unknown) => Promise<void>
          readEvidence: (input: unknown) => Promise<unknown>
        }
      }).createReleaseEffects
      const effects = createReleaseEffects({
        repositoryRoot,
        targetVersion: '3.0.0',
      })
      const evidence = structuredClone(pushedEvidence)

      await effects.initializeEvidence(evidence)

      const evidencePath = join(
        repositoryRoot,
        '.release-evidence',
        '3.0.0',
        'release.json',
      )
      await expect(readFile(evidencePath, 'utf8'))
        .resolves.toBe(`${JSON.stringify(evidence, null, 2)}\n`)
      await expect(effects.initializeEvidence({
        ...evidence,
        status: 'blocked',
      })).rejects.toThrow('already exists')
      await expect(readFile(evidencePath, 'utf8'))
        .resolves.toBe(`${JSON.stringify(evidence, null, 2)}\n`)

      const updatedEvidence = { ...evidence, status: 'verified' }
      await effects.writeEvidence(updatedEvidence)
      await expect(effects.readEvidence({
        repositoryRoot,
        targetVersion: '3.0.0',
      })).resolves.toEqual(updatedEvidence)
    }
    finally {
      await rm(repositoryRoot, { recursive: true, force: true })
    }
  })

  it('runs both frozen profiles through Volta and cleans temporary protocol files', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'release-profile-parent-test-'))
    try {
      const requests: unknown[] = []
      const profileProcessRunner = vi.fn(async ({ args }: {
        args: string[]
      }) => {
        const requestPath = args[args.indexOf('--request') + 1]!
        const resultPath = args[args.indexOf('--result') + 1]!
        const request = JSON.parse(await readFile(requestPath, 'utf8'))
        requests.push(request)
        await writeFile(
          resultPath,
          `${JSON.stringify(createArtifactProfileEvidence(request.profile), null, 2)}\n`,
          'utf8',
        )
      })
      const createReleaseEffects = (releaseModule as unknown as {
        createReleaseEffects: (options: unknown) => {
          verifyArtifactProfiles: (input: unknown) => Promise<unknown>
        }
      }).createReleaseEffects
      const effects = createReleaseEffects({
        profileProcessRunner,
        repositoryRoot: '/repo',
        temporaryRoot,
      })

      await expect(effects.verifyArtifactProfiles({
        artifact: retainedArtifact,
        profiles: [minimumReleaseProfile, knownLatestReleaseProfile],
      })).resolves.toMatchObject({
        success: true,
        profiles: [
          { id: minimumReleaseProfile.id, success: true },
          { id: knownLatestReleaseProfile.id, success: true },
        ],
      })

      expect(profileProcessRunner).toHaveBeenNthCalledWith(1, expect.objectContaining({
        command: 'volta',
        args: expect.arrayContaining([
          'run', '--node', '22.19.0', 'node',
          '--request', expect.stringMatching(/request\.json$/),
          '--result', expect.stringMatching(/result\.json$/),
        ]),
        cwd: '/repo',
      }))
      expect(profileProcessRunner).toHaveBeenNthCalledWith(2, expect.objectContaining({
        command: 'volta',
        args: expect.arrayContaining([
          'run', '--node', '24.19.0', 'node',
          '--request', expect.stringMatching(/request\.json$/),
          '--result', expect.stringMatching(/result\.json$/),
        ]),
        cwd: '/repo',
      }))
      expect(requests).toEqual([
        {
          schemaVersion: 1,
          artifact: retainedArtifact,
          profile: minimumReleaseProfile,
        },
        {
          schemaVersion: 1,
          artifact: retainedArtifact,
          profile: knownLatestReleaseProfile,
        },
      ])
      await expect(readdir(temporaryRoot)).resolves.toEqual([])
    }
    finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })

  it('freezes only the shallow dependency contract from the retained artifact manifest', async () => {
    const commandRunner = vi.fn(async () => ({
      stdout: JSON.stringify({
        engines: { node: '>=22.19.0', pnpm: '>=10' },
        peerDependencies: {
          '@nuxt/content': '>=3.5.0 <4.0.0',
          'nuxt': '^4.1.0',
          'vue': '^3.5.0',
        },
        dependencies: {
          '@nuxt/kit': '^4.5.2',
          'defu': '^6.1.4',
          'mermaid': '~11.16.1',
        },
      }),
    }))
    const createReleaseEffects = (releaseModule as unknown as {
      createReleaseEffects: (options: unknown) => {
        readReleaseManifestSnapshot: (input: unknown) => Promise<unknown>
      }
    }).createReleaseEffects
    const effects = createReleaseEffects({ commandRunner, repositoryRoot: '/repo' })

    await expect(effects.readReleaseManifestSnapshot({
      artifact: retainedArtifact,
    })).resolves.toEqual(releaseManifestSnapshot)
    expect(commandRunner).toHaveBeenCalledWith({
      command: 'tar',
      args: ['-xOf', retainedArtifact.archivePath, 'package/package.json'],
      cwd: '/repo',
    })
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
      profile: knownLatestReleaseProfile,
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
        profileVersions: knownLatestReleaseProfile.versions,
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
      profile: knownLatestReleaseProfile,
      checks,
    })).resolves.toEqual(manualResults)
    expect(verificationOperations.installConsumer).toHaveBeenCalledWith({
      packageSource: { kind: 'artifact', artifact: retainedArtifact },
      consumerDirectory: '/tmp/manual-consumer-root/consumer',
      profile: knownLatestReleaseProfile,
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
        nodeVersion: knownLatestReleaseProfile.nodeVersion,
        versions: {
          ...knownLatestReleaseProfile.versions,
          nuxt: '4.8.0',
          nuxtContent: '3.8.0',
        },
        expectedResolutions: knownLatestReleaseProfile.expectedResolutions,
      },
    })
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
          initializeEvidence: (evidence: unknown) => Promise<void>
          writeEvidence: (evidence: unknown) => Promise<void>
        }
      }).createReleaseEffects
      const readEvidenceFile = vi.fn(readFile)
      const commandRunner = vi.fn()
      const registryVerifier = vi.fn(async (request: {
        profile: typeof knownLatestReleaseProfile
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
      await initialEffects.initializeEvidence(createPublishedInvestigationEvidence())
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
