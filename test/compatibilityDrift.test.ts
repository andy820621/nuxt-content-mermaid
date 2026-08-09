import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  CompatibilityDriftFailure,
  runCompatibilityDriftCheck,
  runCompatibilityDriftCli,
} from '../scripts/release-verification/compatibility-drift.mjs'
import {
  CompatibilityMatrixVerificationFailure,
  ReleaseVerificationFailure,
} from '../scripts/release-verification/runner.mjs'
import {
  ReleaseVerificationInfrastructureError,
  ReleaseVerificationPackageUserError,
} from '../scripts/release-verification/failure-classification.mjs'

const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url))
const workflowPath = fileURLToPath(
  new URL('../.github/workflows/compatibility-drift.yml', import.meta.url),
)
const sourceCommit = 'a'.repeat(40)

function createResolution(nuxtMajor: 3 | 4) {
  const profile = {
    id: `nuxt-${nuxtMajor}-actual-latest-drift`,
    nodeVersion: process.versions.node,
    versions: {
      betterSqlite3: '12.11.1',
      mermaid: '11.12.3',
      nuxt: nuxtMajor === 3 ? '3.22.1' : '4.6.0',
      nuxtContent: '3.16.0',
      typescript: '5.9.3',
      vueTsc: '3.2.5',
    },
  }
  return {
    requested: {
      nuxt: nuxtMajor === 3 ? '>=3.20.1 <4.0.0' : '>=4.1.0 <5.0.0',
      nuxtContent: '>=3.5.0 <4.0.0',
    },
    resolved: profile.versions,
    profile,
  }
}

describe('Scheduled Compatibility Drift Check', () => {
  it('runs the actual-latest artifact check from main on a schedule and on demand', async () => {
    const [packageJson, workflow] = await Promise.all([
      readFile(packageJsonPath, 'utf8').then(JSON.parse),
      readFile(workflowPath, 'utf8'),
    ])

    expect(packageJson.scripts['test:compatibility-drift'])
      .toBe('node scripts/release-verification/compatibility-drift.mjs')
    expect(workflow).toContain('schedule:')
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('ref: main')
    expect(workflow).toContain('pnpm test:compatibility-drift')
  })

  it('verifies the current main artifact through the shared consumer matrix for Nuxt 3 and Nuxt 4 actual latest', async () => {
    const resolutions = [createResolution(3), createResolution(4)]
    const resolveProfiles = vi.fn(async () => resolutions)
    const matrix = vi.fn(async () => ({
      success: true,
      artifact: {
        filename: 'package.tgz',
        sha256: 'artifact-sha256',
      },
    }))

    const evidence = await runCompatibilityDriftCheck({
      repositoryRoot: '/repo',
      sourceCommit,
      resolveProfiles,
      operations: {} as never,
      runners: {
        matrix,
        single: vi.fn(),
      } as never,
    })

    expect(resolveProfiles).toHaveBeenCalledOnce()
    expect(matrix).toHaveBeenCalledWith({
      packageSource: {
        kind: 'pack',
        repositoryRoot: '/repo',
      },
      profiles: resolutions.map(resolution => resolution.profile),
    }, {})
    expect(evidence).toMatchObject({
      status: 'passed',
      resolutions: resolutions.map(resolution => ({
        requested: resolution.requested,
        resolved: resolution.resolved,
      })),
      initial: {
        artifact: {
          filename: 'package.tgz',
          sha256: 'artifact-sha256',
        },
      },
    })
  })

  it('classifies a fresh-latest registry lookup failure as infrastructure and does not declare drift', async () => {
    const matrix = vi.fn()

    const failure: CompatibilityDriftFailure = await runCompatibilityDriftCheck({
      repositoryRoot: '/repo',
      sourceCommit,
      resolveProfiles: vi.fn(async () => {
        throw new Error('npm registry timed out')
      }),
      operations: {} as never,
      runners: {
        matrix,
        single: vi.fn(),
      },
    }).then(
      () => { throw new Error('expected compatibility drift check to fail') },
      (error: unknown) => error as CompatibilityDriftFailure,
    )

    expect(failure).toBeInstanceOf(CompatibilityDriftFailure)
    expect(failure.evidence).toMatchObject({
      status: 'infrastructure-failure',
      failure: {
        classification: 'infrastructure',
        stage: 'fresh-latest-resolution',
        message: 'npm registry timed out',
      },
    })
    expect(matrix).not.toHaveBeenCalled()
  })

  it('confirms drift only when a clean retry repeats the same Package User failure', async () => {
    const resolution = createResolution(3)
    const initialEvidence = {
      success: false,
      artifact: {
        filename: 'initial-package.tgz',
        sha256: 'initial-artifact-sha256',
      },
      profiles: [{
        id: resolution.profile.id,
        success: false,
        stages: [{ name: 'types', status: 'failed' }],
      }],
    }
    const retryEvidence = {
      success: false,
      artifact: {
        filename: 'retry-package.tgz',
        sha256: 'retry-artifact-sha256',
      },
      profile: {
        id: resolution.profile.id,
      },
      stages: [{ name: 'types', status: 'failed' }],
    }
    const initialFailure = new CompatibilityMatrixVerificationFailure([{
      profileId: resolution.profile.id,
      stage: 'types',
      cause: new ReleaseVerificationPackageUserError('type contract failed'),
    }], initialEvidence as never)
    const retryFailure = new ReleaseVerificationFailure(
      'types',
      new ReleaseVerificationPackageUserError('type contract failed'),
      retryEvidence as never,
    )
    const matrix = vi.fn(() => Promise.reject(initialFailure))
    const single = vi.fn(() => Promise.reject(retryFailure))

    const failure: CompatibilityDriftFailure = await runCompatibilityDriftCheck({
      repositoryRoot: '/repo',
      sourceCommit,
      resolveProfiles: vi.fn(async () => [resolution]),
      operations: {} as never,
      runners: { matrix, single },
    }).then(
      () => { throw new Error('expected compatibility drift check to fail') },
      (error: unknown) => error as CompatibilityDriftFailure,
    )

    expect(single).toHaveBeenCalledWith({
      packageSource: {
        kind: 'pack',
        repositoryRoot: '/repo',
      },
      profile: resolution.profile,
    }, {})
    expect(failure.evidence).toMatchObject({
      status: 'confirmed-drift',
      sourceCommit,
      initial: initialEvidence,
      failure: {
        classification: 'confirmed-drift',
        profileId: resolution.profile.id,
        stage: 'types',
      },
      retries: [{
        profile: resolution.profile,
        evidence: retryEvidence,
      }],
    })
    expect('rerun' in failure.evidence && failure.evidence.rerun?.command)
      .toContain(`--source-commit ${sourceCommit}`)
  })

  it('classifies a consumer dependency download failure as infrastructure without retrying it as drift', async () => {
    const resolution = createResolution(4)
    const initialFailure = new CompatibilityMatrixVerificationFailure([{
      profileId: resolution.profile.id,
      stage: 'install',
      cause: new ReleaseVerificationInfrastructureError('npm registry connection reset'),
    }], {
      schemaVersion: 1,
      success: false,
      mode: 'package-artifact-matrix',
      package: null,
      artifact: null,
      profiles: [],
      stages: [],
    })
    const single = vi.fn()

    const failure: CompatibilityDriftFailure = await runCompatibilityDriftCheck({
      repositoryRoot: '/repo',
      sourceCommit,
      resolveProfiles: vi.fn(async () => [resolution]),
      operations: {} as never,
      runners: {
        matrix: vi.fn(() => Promise.reject(initialFailure)),
        single,
      },
    }).then(
      () => { throw new Error('expected compatibility drift check to fail') },
      (error: unknown) => error as CompatibilityDriftFailure,
    )

    expect(failure.evidence).toMatchObject({
      status: 'infrastructure-failure',
      failure: {
        classification: 'infrastructure',
        stage: 'install',
      },
    })
    expect(single).not.toHaveBeenCalled()
  })

  it('classifies a network error wrapped by a Package User stage as infrastructure', async () => {
    const resolution = createResolution(3)
    const initialFailure = new CompatibilityMatrixVerificationFailure([{
      profileId: resolution.profile.id,
      stage: 'types',
      cause: new ReleaseVerificationInfrastructureError('npm network request failed with ECONNRESET'),
    }], {
      schemaVersion: 1,
      success: false,
      mode: 'package-artifact-matrix',
      package: null,
      artifact: null,
      profiles: [],
      stages: [],
    })
    const single = vi.fn()

    const failure: CompatibilityDriftFailure = await runCompatibilityDriftCheck({
      repositoryRoot: '/repo',
      sourceCommit,
      resolveProfiles: vi.fn(async () => [resolution]),
      operations: {} as never,
      runners: {
        matrix: vi.fn(() => Promise.reject(initialFailure)),
        single,
      },
    }).then(
      () => { throw new Error('expected compatibility drift check to fail') },
      (error: unknown) => error as CompatibilityDriftFailure,
    )

    expect(failure.evidence).toMatchObject({
      status: 'infrastructure-failure',
      failure: {
        classification: 'infrastructure',
        stage: 'types',
      },
    })
    expect(single).not.toHaveBeenCalled()
  })

  it('replays an emitted retry profile through the shared single-profile consumer runner', async () => {
    const profile = createResolution(3).profile
    const retryProfile = Buffer.from(JSON.stringify(profile)).toString('base64url')
    const single = vi.fn(async () => ({
      success: true,
      artifact: {
        filename: 'retry-package.tgz',
        sha256: 'retry-artifact-sha256',
      },
    }))
    const writeEvidence = vi.fn()

    const evidence = await runCompatibilityDriftCli({
      argv: ['--retry-profile', retryProfile, '--source-commit', sourceCommit],
      repositoryRoot: '/repo',
      sourceCommit,
      resolveProfiles: vi.fn(),
      operations: {} as never,
      runners: {
        matrix: vi.fn(),
        single,
      } as never,
      writeEvidence,
    })

    expect(single).toHaveBeenCalledWith({
      packageSource: {
        kind: 'pack',
        repositoryRoot: '/repo',
      },
      profile,
    }, {})
    expect(evidence).toMatchObject({
      status: 'retry-passed',
      profile,
    })
    expect(writeEvidence).toHaveBeenCalledWith(evidence)
  })

  it('refuses to pack a retry when the checkout does not match the recorded source commit', async () => {
    const profile = createResolution(3).profile
    const retryProfile = Buffer.from(JSON.stringify(profile)).toString('base64url')
    const single = vi.fn()

    const failure: CompatibilityDriftFailure = await runCompatibilityDriftCli({
      argv: ['--retry-profile', retryProfile, '--source-commit', sourceCommit],
      repositoryRoot: '/repo',
      sourceCommit: 'b'.repeat(40),
      operations: {} as never,
      runners: {
        matrix: vi.fn(),
        single,
      } as never,
      writeEvidence: vi.fn(),
    }).then(
      () => { throw new Error('expected mismatched retry to fail') },
      (error: unknown) => error as CompatibilityDriftFailure,
    )

    expect(failure.evidence).toMatchObject({
      status: 'retry-failed',
      sourceCommit: 'b'.repeat(40),
      failure: {
        classification: 'infrastructure',
        stage: 'source-commit',
      },
    })
    expect(single).not.toHaveBeenCalled()
  })

  it('classifies a network failure wrapped by an independent retry stage as infrastructure', async () => {
    const profile = createResolution(3).profile
    const retryProfile = Buffer.from(JSON.stringify(profile)).toString('base64url')
    const single = vi.fn(() => Promise.reject(new ReleaseVerificationFailure(
      'types',
      new ReleaseVerificationInfrastructureError('npm network request failed with ECONNRESET'),
      {
        schemaVersion: 1,
        success: false,
        mode: 'package-artifact',
        package: null,
        artifact: null,
        profile: {
          id: profile.id,
          requested: profile.versions,
          resolved: null,
        },
        runtime: {
          requested: profile.nodeVersion,
          observed: process.versions.node,
        },
        stages: [],
      },
    )))

    const failure: CompatibilityDriftFailure = await runCompatibilityDriftCli({
      argv: ['--retry-profile', retryProfile, '--source-commit', sourceCommit],
      repositoryRoot: '/repo',
      sourceCommit,
      operations: {} as never,
      runners: {
        matrix: vi.fn(),
        single,
      } as never,
      writeEvidence: vi.fn(),
    }).then(
      () => { throw new Error('expected network retry to fail') },
      (error: unknown) => error as CompatibilityDriftFailure,
    )

    expect(failure.evidence).toMatchObject({
      status: 'retry-failed',
      failure: {
        classification: 'infrastructure',
        stage: 'types',
      },
    })
  })

  it('retries a peer dependency installation failure as a Package User compatibility candidate', async () => {
    const resolution = createResolution(4)
    const initialFailure = new CompatibilityMatrixVerificationFailure([{
      profileId: resolution.profile.id,
      stage: 'install',
      cause: new ReleaseVerificationPackageUserError('npm error ERESOLVE could not resolve dependency tree'),
    }], {
      schemaVersion: 1,
      success: false,
      mode: 'package-artifact-matrix',
      package: null,
      artifact: null,
      profiles: [],
      stages: [],
    })
    const retryFailure = new ReleaseVerificationFailure(
      'install',
      new ReleaseVerificationPackageUserError('npm error ERESOLVE could not resolve dependency tree'),
      {
        schemaVersion: 1,
        success: false,
        mode: 'package-artifact',
        package: null,
        artifact: null,
        profile: {
          id: resolution.profile.id,
          requested: resolution.profile.versions,
          resolved: null,
        },
        runtime: {
          requested: resolution.profile.nodeVersion,
          observed: process.versions.node,
        },
        stages: [],
      },
    )
    const single = vi.fn(() => Promise.reject(retryFailure))

    const failure: CompatibilityDriftFailure = await runCompatibilityDriftCheck({
      repositoryRoot: '/repo',
      sourceCommit,
      resolveProfiles: vi.fn(async () => [resolution]),
      operations: {} as never,
      runners: {
        matrix: vi.fn(() => Promise.reject(initialFailure)),
        single,
      },
    }).then(
      () => { throw new Error('expected peer incompatibility to fail') },
      (error: unknown) => error as CompatibilityDriftFailure,
    )

    expect(single).toHaveBeenCalledOnce()
    expect(failure.evidence).toMatchObject({
      status: 'confirmed-drift',
      failure: {
        classification: 'confirmed-drift',
        profileId: resolution.profile.id,
        stage: 'install',
      },
    })
  })

  it('refuses an independent retry from a dirty worktree before packing', async () => {
    const profile = createResolution(3).profile
    const retryProfile = Buffer.from(JSON.stringify(profile)).toString('base64url')
    const commandRunner = vi.fn(async ({ args }: { args: string[] }) => {
      if (args.join(' ') === 'rev-parse HEAD') return { stdout: `${sourceCommit}\n` }
      if (args.join(' ') === 'status --porcelain=v1 --untracked-files=all') {
        return { stdout: ' M package.json\n' }
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`)
    })
    const single = vi.fn()

    const failure: CompatibilityDriftFailure = await runCompatibilityDriftCli({
      argv: ['--retry-profile', retryProfile, '--source-commit', sourceCommit],
      repositoryRoot: '/repo',
      commandRunner,
      operations: {} as never,
      runners: {
        matrix: vi.fn(),
        single,
      } as never,
      writeEvidence: vi.fn(),
    }).then(
      () => { throw new Error('expected dirty retry to fail') },
      (error: unknown) => error as CompatibilityDriftFailure,
    )

    expect(failure.evidence).toMatchObject({
      status: 'infrastructure-failure',
      failure: {
        classification: 'infrastructure',
        stage: 'source-commit',
        message: 'Compatibility Drift Check requires a clean worktree',
      },
    })
    expect(single).not.toHaveBeenCalled()
  })

  it('classifies a clean-retry runner failure as infrastructure instead of confirmed drift', async () => {
    const resolution = createResolution(3)
    const initialFailure = new CompatibilityMatrixVerificationFailure([{
      profileId: resolution.profile.id,
      stage: 'build',
      cause: new ReleaseVerificationPackageUserError('consumer build failed'),
    }], {
      schemaVersion: 1,
      success: false,
      mode: 'package-artifact-matrix',
      package: null,
      artifact: null,
      profiles: [],
      stages: [],
    })
    const retryFailure = new Error('runner process was interrupted')

    const failure: CompatibilityDriftFailure = await runCompatibilityDriftCheck({
      repositoryRoot: '/repo',
      sourceCommit,
      resolveProfiles: vi.fn(async () => [resolution]),
      operations: {} as never,
      runners: {
        matrix: vi.fn(() => Promise.reject(initialFailure)),
        single: vi.fn(() => Promise.reject(retryFailure)),
      },
    }).then(
      () => { throw new Error('expected compatibility drift check to fail') },
      (error: unknown) => error as CompatibilityDriftFailure,
    )

    expect(failure.evidence).toMatchObject({
      status: 'infrastructure-failure',
      failure: {
        classification: 'infrastructure',
        stage: 'runner',
        message: 'runner process was interrupted',
      },
      retries: [{
        profile: resolution.profile,
        status: 'failed',
        stage: 'runner',
      }],
    })
  })

  it('does not report confirmed drift when another profile retry has an infrastructure failure', async () => {
    const nuxt3 = createResolution(3)
    const nuxt4 = createResolution(4)
    const initialFailure = new CompatibilityMatrixVerificationFailure([
      {
        profileId: nuxt3.profile.id,
        stage: 'types',
        cause: new ReleaseVerificationPackageUserError('type contract failed'),
      },
      {
        profileId: nuxt4.profile.id,
        stage: 'runtime',
        cause: new ReleaseVerificationPackageUserError('SVG did not render'),
      },
    ], {
      schemaVersion: 1,
      success: false,
      mode: 'package-artifact-matrix',
      package: null,
      artifact: null,
      profiles: [],
      stages: [],
    })
    const verifiedRetry = new ReleaseVerificationFailure(
      'types',
      new ReleaseVerificationPackageUserError('type contract failed'),
      {
        schemaVersion: 1,
        success: false,
        mode: 'package-artifact',
        package: null,
        artifact: null,
        profile: {
          id: nuxt3.profile.id,
          requested: nuxt3.profile.versions,
          resolved: null,
        },
        runtime: {
          requested: nuxt3.profile.nodeVersion,
          observed: process.versions.node,
        },
        stages: [],
      },
    )
    const single = vi.fn()
      .mockRejectedValueOnce(verifiedRetry)
      .mockRejectedValueOnce(new Error('runner process was interrupted'))

    const failure: CompatibilityDriftFailure = await runCompatibilityDriftCheck({
      repositoryRoot: '/repo',
      sourceCommit,
      resolveProfiles: vi.fn(async () => [nuxt3, nuxt4]),
      operations: {} as never,
      runners: {
        matrix: vi.fn(() => Promise.reject(initialFailure)),
        single,
      },
    }).then(
      () => { throw new Error('expected compatibility drift check to fail') },
      (error: unknown) => error as CompatibilityDriftFailure,
    )

    expect(failure.evidence).toMatchObject({
      status: 'infrastructure-failure',
      failure: {
        classification: 'infrastructure',
        stage: 'runner',
      },
    })
  })

  it('writes first-failure retry evidence and rejects so the workflow finishes nonzero', async () => {
    const resolution = createResolution(4)
    const initialFailure = new CompatibilityMatrixVerificationFailure([{
      profileId: resolution.profile.id,
      stage: 'runtime',
      cause: new ReleaseVerificationPackageUserError('SVG did not render'),
    }], {
      schemaVersion: 1,
      success: false,
      mode: 'package-artifact-matrix',
      package: null,
      artifact: null,
      profiles: [],
      stages: [],
    })
    const writeEvidence = vi.fn()

    const failure: CompatibilityDriftFailure = await runCompatibilityDriftCli({
      repositoryRoot: '/repo',
      sourceCommit,
      resolveProfiles: vi.fn(async () => [resolution]),
      operations: {} as never,
      runners: {
        matrix: vi.fn(() => Promise.reject(initialFailure)),
        single: vi.fn(async () => ({ success: true })),
      } as never,
      writeEvidence,
    }).then(
      () => { throw new Error('expected compatibility drift CLI to fail') },
      (error: unknown) => error as CompatibilityDriftFailure,
    )

    expect(failure.evidence).toMatchObject({
      status: 'needs-investigation',
      failure: {
        classification: 'unconfirmed-package-user-failure',
        profileId: resolution.profile.id,
        stage: 'runtime',
      },
    })
    expect('rerun' in failure.evidence && failure.evidence.rerun?.command)
      .toContain('--retry-profile')
    expect(writeEvidence).toHaveBeenCalledWith(failure.evidence)
  })

  it('treats an unclassified runner failure under a Package User stage as infrastructure', async () => {
    const resolution = createResolution(3)
    const initialFailure = new CompatibilityMatrixVerificationFailure([{
      profileId: resolution.profile.id,
      stage: 'runtime',
      cause: new Error('browserType.launch: Executable doesn\'t exist'),
    }], {
      schemaVersion: 1,
      success: false,
      mode: 'package-artifact-matrix',
      package: null,
      artifact: null,
      profiles: [],
      stages: [],
    })
    const single = vi.fn()

    const failure: CompatibilityDriftFailure = await runCompatibilityDriftCheck({
      repositoryRoot: '/repo',
      sourceCommit,
      resolveProfiles: vi.fn(async () => [resolution]),
      operations: {} as never,
      runners: {
        matrix: vi.fn(() => Promise.reject(initialFailure)),
        single,
      },
    }).then(
      () => { throw new Error('expected compatibility drift check to fail') },
      (error: unknown) => error as CompatibilityDriftFailure,
    )

    expect(failure.evidence).toMatchObject({
      status: 'infrastructure-failure',
      failure: {
        classification: 'infrastructure',
        stage: 'runtime',
      },
    })
    expect(single).not.toHaveBeenCalled()
  })
})
