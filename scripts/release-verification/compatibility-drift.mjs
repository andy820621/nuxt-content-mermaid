import {
  CompatibilityMatrixVerificationFailure,
  ReleaseVerificationFailure,
  runPackageArtifactMatrixVerification,
  runPackageArtifactVerification,
} from './runner.mjs'
import { createReleaseVerificationOperations, runCommand } from './operations.mjs'
import { isPackageUserFailure } from './failure-classification.mjs'
import { parseVersionProfile } from './profiles.mjs'
import { createReleaseEffects } from './release.mjs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_USER_STAGES = new Set(['install', 'exports', 'types', 'build', 'runtime'])
const GIT_COMMIT_PATTERN = /^[0-9a-f]{40,64}$/i
const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const defaultRepositoryRoot = resolve(scriptDirectory, '../..')

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function assertSourceCommit(sourceCommit) {
  if (!GIT_COMMIT_PATTERN.test(sourceCommit)) {
    throw new Error('Compatibility Drift Check requires an exact source commit')
  }
  return sourceCommit
}

function retryCommand(profile, sourceCommit) {
  const encodedProfile = Buffer.from(JSON.stringify(profile)).toString('base64url')
  return `pnpm test:compatibility-drift -- --retry-profile ${encodedProfile} --source-commit ${sourceCommit}`
}

function parseRetryProfile(encodedProfile) {
  try {
    return parseVersionProfile(JSON.parse(Buffer.from(encodedProfile, 'base64url').toString()))
  }
  catch {
    throw new Error('Invalid retry profile')
  }
}

export function parseCompatibilityDriftArguments(argv) {
  if (argv.length === 0) return { mode: 'scheduled' }
  if (argv.length === 4
    && argv[0] === '--retry-profile'
    && argv[2] === '--source-commit') {
    return {
      mode: 'retry',
      profile: parseRetryProfile(argv[1]),
      sourceCommit: assertSourceCommit(argv[3]),
    }
  }
  throw new Error(
    'Compatibility Drift Check accepts only --retry-profile <encoded-profile> --source-commit <commit>',
  )
}

async function resolveActualLatestProfiles({ repositoryRoot, commandRunner }) {
  const effects = createReleaseEffects({ commandRunner, repositoryRoot })
  return Promise.all([3, 4].map(nuxtMajor => effects.resolveCompatibilityProfile({
    nuxtMajor,
    profileId: `nuxt-${nuxtMajor}-actual-latest-drift`,
  })))
}

function createOperations(repositoryRoot) {
  return createReleaseVerificationOperations({
    templateDirectory: join(repositoryRoot, 'test/release-verification/consumer-template'),
  })
}

async function readSourceCommit({ commandRunner, repositoryRoot }) {
  const [commitResult, statusResult] = await Promise.all([
    commandRunner({
      command: 'git',
      args: ['rev-parse', 'HEAD'],
      cwd: repositoryRoot,
    }),
    commandRunner({
      command: 'git',
      args: ['status', '--porcelain=v1', '--untracked-files=all'],
      cwd: repositoryRoot,
    }),
  ])
  if (String(statusResult?.stdout ?? '').trim()) {
    throw new Error('Compatibility Drift Check requires a clean worktree')
  }
  return assertSourceCommit(String(commitResult?.stdout ?? '').trim())
}

function packageUserFailures(error) {
  if (!(error instanceof CompatibilityMatrixVerificationFailure)) return []
  if (error.failures.length === 0) return []
  if (error.failures.some(failure => (
    !failure.profileId
    || !PACKAGE_USER_STAGES.has(failure.stage)
    || !isPackageUserFailure(failure.cause)
  ))) {
    return []
  }
  return error.failures
}

export class CompatibilityDriftFailure extends Error {
  constructor(evidence, cause) {
    super(`Compatibility Drift Check failed: ${evidence.status}`)
    this.name = 'CompatibilityDriftFailure'
    this.evidence = evidence
    this.cause = cause
  }
}

export async function runCompatibilityDriftCheck({
  repositoryRoot,
  sourceCommit,
  resolveProfiles,
  operations,
  runners,
}) {
  const evidence = {
    schemaVersion: 1,
    status: 'running',
    sourceCommit: assertSourceCommit(sourceCommit),
    resolutions: [],
    initial: null,
    failure: null,
  }
  let resolutions
  try {
    resolutions = await resolveProfiles()
  }
  catch (error) {
    evidence.status = 'infrastructure-failure'
    evidence.failure = {
      classification: 'infrastructure',
      stage: 'fresh-latest-resolution',
      message: errorMessage(error),
    }
    throw new CompatibilityDriftFailure(evidence, error)
  }

  evidence.resolutions = resolutions.map(({ requested, resolved }) => ({ requested, resolved }))
  const packageSource = {
    kind: 'pack',
    repositoryRoot,
  }
  try {
    evidence.initial = await runners.matrix({
      packageSource,
      profiles: resolutions.map(resolution => resolution.profile),
    }, operations)
  }
  catch (error) {
    if (error instanceof CompatibilityMatrixVerificationFailure) {
      evidence.initial = error.evidence
    }
    const failures = packageUserFailures(error)
    if (failures.length === 0) {
      evidence.status = 'infrastructure-failure'
      evidence.failure = {
        classification: 'infrastructure',
        stage: error instanceof CompatibilityMatrixVerificationFailure
          ? error.failures[0]?.stage ?? 'matrix'
          : 'runner',
        message: errorMessage(error),
      }
      throw new CompatibilityDriftFailure(evidence, error)
    }

    const profiles = new Map(resolutions.map(resolution => [resolution.profile.id, resolution.profile]))
    const retries = []
    const confirmed = []
    const retryInfrastructureFailures = []
    for (const failure of failures) {
      const profile = profiles.get(failure.profileId)
      if (!profile) {
        evidence.status = 'infrastructure-failure'
        evidence.failure = {
          classification: 'infrastructure',
          stage: 'profile-selection',
          message: `Fresh-latest resolution did not produce ${failure.profileId}`,
        }
        throw new CompatibilityDriftFailure(evidence, error)
      }
      try {
        const retryEvidence = await runners.single({ packageSource, profile }, operations)
        retries.push({ profile, evidence: retryEvidence, status: 'passed' })
      }
      catch (retryError) {
        const retryEvidence = retryError instanceof ReleaseVerificationFailure
          ? retryError.evidence
          : null
        retries.push({
          profile,
          evidence: retryEvidence,
          status: 'failed',
          stage: retryError instanceof ReleaseVerificationFailure ? retryError.stage : 'runner',
          message: errorMessage(retryError),
        })
        if (retryError instanceof ReleaseVerificationFailure
          && isPackageUserFailure(retryError)
          && retryError.stage === failure.stage
          && PACKAGE_USER_STAGES.has(retryError.stage)) {
          confirmed.push({
            profile,
            stage: retryError.stage,
            message: errorMessage(retryError),
          })
        }
        else if (!(retryError instanceof ReleaseVerificationFailure)
          || !isPackageUserFailure(retryError)
          || !PACKAGE_USER_STAGES.has(retryError.stage)) {
          retryInfrastructureFailures.push({
            profile,
            stage: retryError instanceof ReleaseVerificationFailure ? retryError.stage : 'runner',
            message: errorMessage(retryError),
          })
        }
      }
    }
    evidence.retries = retries
    if (retryInfrastructureFailures.length > 0) {
      const first = retryInfrastructureFailures[0]
      evidence.status = 'infrastructure-failure'
      evidence.failure = {
        classification: 'infrastructure',
        stage: first.stage,
        message: first.message,
      }
      evidence.rerun = {
        command: retryCommand(first.profile, sourceCommit),
      }
    }
    else if (confirmed.length > 0) {
      const first = confirmed[0]
      evidence.status = 'confirmed-drift'
      evidence.failure = {
        classification: 'confirmed-drift',
        profileId: first.profile.id,
        stage: first.stage,
        message: first.message,
      }
      evidence.rerun = {
        command: retryCommand(first.profile, sourceCommit),
      }
    }
    else {
      const first = failures[0]
      evidence.status = 'needs-investigation'
      evidence.failure = {
        classification: 'unconfirmed-package-user-failure',
        profileId: first.profileId,
        stage: first.stage,
        message: errorMessage(first.cause),
      }
      evidence.rerun = {
        command: retryCommand(profiles.get(first.profileId), sourceCommit),
      }
    }
    throw new CompatibilityDriftFailure(evidence, error)
  }

  evidence.status = 'passed'
  return evidence
}

export async function runCompatibilityDriftCli({
  argv = [],
  repositoryRoot = defaultRepositoryRoot,
  sourceCommit,
  commandRunner = runCommand,
  resolveProfiles,
  operations,
  runners = {
    matrix: runPackageArtifactMatrixVerification,
    single: runPackageArtifactVerification,
  },
  writeEvidence = evidence => console.log(JSON.stringify(evidence, null, 2)),
} = {}) {
  const request = parseCompatibilityDriftArguments(argv)
  const activeOperations = operations ?? createOperations(repositoryRoot)
  let activeSourceCommit
  try {
    activeSourceCommit = sourceCommit ?? await readSourceCommit({
      commandRunner,
      repositoryRoot,
    })
    assertSourceCommit(activeSourceCommit)
  }
  catch (error) {
    const evidence = {
      schemaVersion: 1,
      status: 'infrastructure-failure',
      sourceCommit: null,
      resolutions: [],
      initial: null,
      failure: {
        classification: 'infrastructure',
        stage: 'source-commit',
        message: errorMessage(error),
      },
    }
    writeEvidence(evidence)
    throw new CompatibilityDriftFailure(evidence, error)
  }
  if (request.mode === 'retry') {
    if (request.sourceCommit !== activeSourceCommit) {
      const evidence = {
        schemaVersion: 1,
        status: 'retry-failed',
        sourceCommit: activeSourceCommit,
        profile: request.profile,
        failure: {
          classification: 'infrastructure',
          stage: 'source-commit',
          message: `Retry requires ${request.sourceCommit}, received ${activeSourceCommit}`,
        },
        result: null,
      }
      writeEvidence(evidence)
      throw new CompatibilityDriftFailure(evidence)
    }
    try {
      const result = await runners.single({
        packageSource: {
          kind: 'pack',
          repositoryRoot,
        },
        profile: request.profile,
      }, activeOperations)
      const evidence = {
        schemaVersion: 1,
        status: 'retry-passed',
        sourceCommit: activeSourceCommit,
        profile: request.profile,
        result,
      }
      writeEvidence(evidence)
      return evidence
    }
    catch (error) {
      const evidence = {
        schemaVersion: 1,
        status: 'retry-failed',
        sourceCommit: activeSourceCommit,
        profile: request.profile,
        failure: {
          classification: error instanceof ReleaseVerificationFailure
            && isPackageUserFailure(error)
            && PACKAGE_USER_STAGES.has(error.stage)
            ? 'package-user-failure'
            : 'infrastructure',
          stage: error instanceof ReleaseVerificationFailure ? error.stage : 'runner',
          message: errorMessage(error),
        },
        result: error instanceof ReleaseVerificationFailure ? error.evidence : null,
      }
      writeEvidence(evidence)
      throw new CompatibilityDriftFailure(evidence, error)
    }
  }

  const activeResolveProfiles = resolveProfiles ?? (() => resolveActualLatestProfiles({
    commandRunner,
    repositoryRoot,
  }))
  try {
    const evidence = await runCompatibilityDriftCheck({
      repositoryRoot,
      sourceCommit: activeSourceCommit,
      resolveProfiles: activeResolveProfiles,
      operations: activeOperations,
      runners,
    })
    writeEvidence(evidence)
    return evidence
  }
  catch (error) {
    if (error instanceof CompatibilityDriftFailure) writeEvidence(error.evidence)
    throw error
  }
}

async function main() {
  try {
    await runCompatibilityDriftCli({ argv: process.argv.slice(2) })
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
