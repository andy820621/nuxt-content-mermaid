import { parseExactSemver } from './exact-semver.mjs'

const VERIFICATION_STAGES = [
  'node-runtime',
  'artifact',
  'archive',
  'install',
  'exports',
  'types',
  'build',
  'runtime',
]
const CONSUMER_STAGES = ['install', 'exports', 'types', 'build', 'runtime']

class StageExecutionFailure extends Error {
  constructor(stage, cause) {
    super(errorMessage(cause))
    this.name = 'StageExecutionFailure'
    this.stage = stage
    this.cause = cause
  }
}

export class ReleaseVerificationFailure extends Error {
  constructor(stage, cause, evidence) {
    super('Release verification failed during ' + stage + ': ' + errorMessage(cause))
    this.name = 'ReleaseVerificationFailure'
    this.stage = stage
    this.cause = cause
    this.evidence = evidence
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function createRuntimeEvidence(profile) {
  return {
    requested: typeof profile.nodeVersion === 'string'
      ? profile.nodeVersion
      : null,
    observed: process.versions.node,
  }
}

function createProfileEvidence(profile) {
  return {
    id: profile.id,
    requested: { ...profile.versions },
    resolved: null,
    ...(profile.expectedResolutions
      ? {
          expectedResolutions: {
            requested: { ...profile.expectedResolutions },
            resolved: null,
          },
        }
      : {}),
  }
}

function createEvidence(request) {
  return {
    schemaVersion: 1,
    success: false,
    mode: 'package-artifact',
    package: null,
    artifact: null,
    profile: createProfileEvidence(request.profile),
    runtime: createRuntimeEvidence(request.profile),
    stages: [],
  }
}

function validateNodeRuntime(profile) {
  if (!parseExactSemver(profile?.nodeVersion)) {
    throw new Error(
      'Version Profile ' + (profile?.id ?? '<unknown>') + ' must declare one exact Node runtime',
    )
  }
  if (profile.nodeVersion !== process.versions.node) {
    throw new Error(
      'Node runtime mismatch for Version Profile ' + profile.id
      + ': requested ' + profile.nodeVersion
      + ', observed ' + process.versions.node,
    )
  }
}

function validateExpectedResolutions(profile, installation) {
  if (!profile.expectedResolutions) return
  if (!installation.expectedResolutions) {
    throw new Error(
      'Version Profile ' + profile.id + ' installation did not report expected resolutions',
    )
  }
  for (const key of ['nuxtKit', 'nuxtSchema']) {
    const requested = profile.expectedResolutions[key]
    const resolved = installation.expectedResolutions[key]
    if (resolved !== requested) {
      throw new Error(
        'Version Profile ' + profile.id + ' resolution mismatch for ' + key
        + ': requested ' + requested + ', resolved ' + resolved,
      )
    }
  }
}

async function runStage(evidence, name, task) {
  const startedAt = Date.now()
  try {
    const result = await task()
    evidence.stages.push({
      name,
      status: 'passed',
      durationMs: Date.now() - startedAt,
    })
    return result
  }
  catch (error) {
    evidence.stages.push({
      name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: errorMessage(error),
    })
    throw new StageExecutionFailure(name, error)
  }
}

function markRemainingStagesSkipped(evidence, failedStage, stages = VERIFICATION_STAGES) {
  const failedIndex = stages.indexOf(failedStage)
  for (const name of stages.slice(failedIndex + 1)) {
    evidence.stages.push({
      name,
      status: 'skipped',
      reason: 'required stage ' + failedStage + ' failed',
    })
  }
}

async function cleanupVerificationWorkspace(evidence, workspace, operations) {
  if (!workspace) {
    evidence.stages.push({
      name: 'cleanup',
      status: 'skipped',
      reason: 'temporary workspace was not created',
    })
    return undefined
  }

  try {
    await runStage(evidence, 'cleanup', () => operations.cleanupWorkspace(workspace.root))
    return undefined
  }
  catch (error) {
    return error
  }
}

async function runConsumerVerification({
  artifact,
  evidence,
  operations,
  profile,
  workspace,
}) {
  let primaryFailure

  try {
    const installation = await runStage(evidence, 'install', async () => {
      const result = await operations.installConsumer({
        artifact,
        consumerDirectory: workspace.consumerDirectory,
        profile,
      })
      validateExpectedResolutions(profile, result)
      return result
    })
    evidence.profile.resolved = installation.profileVersions
    if (evidence.profile.expectedResolutions) {
      evidence.profile.expectedResolutions.resolved = installation.expectedResolutions
    }

    await runStage(evidence, 'exports', () => operations.verifyPackageExports({
      artifact,
      consumerDirectory: workspace.consumerDirectory,
    }))
    await runStage(evidence, 'types', () => operations.verifyTypes({
      consumerDirectory: workspace.consumerDirectory,
    }))
    await runStage(evidence, 'build', () => operations.buildConsumer({
      consumerDirectory: workspace.consumerDirectory,
    }))
    await runStage(evidence, 'runtime', () => operations.smokeRuntime({
      consumerDirectory: workspace.consumerDirectory,
    }))
  }
  catch (error) {
    primaryFailure = error instanceof StageExecutionFailure
      ? error
      : new StageExecutionFailure('install', error)
    markRemainingStagesSkipped(evidence, primaryFailure.stage, CONSUMER_STAGES)
  }

  const cleanupFailure = await cleanupVerificationWorkspace(evidence, workspace, operations)
  return primaryFailure ?? cleanupFailure
}

export async function runPackageArtifactVerification(request, operations) {
  if (!request?.artifact) {
    throw new Error('Package verification requires one artifact')
  }

  const evidence = createEvidence(request)
  let workspace
  let primaryFailure
  const artifact = request.artifact

  try {
    await runStage(evidence, 'node-runtime', () => validateNodeRuntime(request.profile))
    await runStage(evidence, 'artifact', async () => {
      workspace = await operations.createWorkspace()
    })

    evidence.package = {
      name: artifact.packageName,
      version: artifact.packageVersion,
    }
    evidence.artifact = {
      filename: artifact.filename,
      sha256: artifact.sha256,
    }

    await runStage(evidence, 'archive', () => operations.inspectArchive({
      archiveDirectory: workspace.archiveDirectory,
      artifact,
    }))
  }
  catch (error) {
    primaryFailure = error instanceof StageExecutionFailure
      ? error
      : new StageExecutionFailure('artifact', error)
    markRemainingStagesSkipped(evidence, primaryFailure.stage)
  }

  const consumerFailure = primaryFailure
    ? await cleanupVerificationWorkspace(evidence, workspace, operations)
    : await runConsumerVerification({
        artifact,
        evidence,
        operations,
        profile: request.profile,
        workspace,
      })

  const failure = primaryFailure ?? consumerFailure
  if (failure) {
    throw new ReleaseVerificationFailure(failure.stage, failure.cause, evidence)
  }

  evidence.success = true
  return evidence
}
