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
const CONSUMER_VERIFICATION_PLANS = Object.freeze({
  artifact: Object.freeze(['install', 'exports', 'types', 'build', 'runtime']),
  registry: Object.freeze(['install', 'build', 'runtime']),
})
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
    super(`Release verification failed during ${stage}: ${errorMessage(cause)}`)
    this.name = 'ReleaseVerificationFailure'
    this.stage = stage
    this.cause = cause
    this.evidence = evidence
  }
}

export class RegistrySmokeVerificationFailure extends Error {
  constructor(stage, cause, evidence) {
    super(`Registry smoke verification failed during ${stage}: ${errorMessage(cause)}`)
    this.name = 'RegistrySmokeVerificationFailure'
    this.stage = stage
    this.cause = cause
    this.evidence = evidence
  }
}

export class CompatibilityMatrixVerificationFailure extends Error {
  constructor(failures, evidence) {
    const summary = failures
      .map(failure => `${failure.profileId ?? 'matrix'}:${failure.stage}`)
      .join(', ')
    super(`Compatibility matrix verification failed: ${summary}`)
    this.name = 'CompatibilityMatrixVerificationFailure'
    this.failures = failures
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

function createEvidence(request) {
  return {
    schemaVersion: 1,
    success: false,
    mode: 'package-artifact',
    package: null,
    artifact: null,
    profile: {
      id: request.profile.id,
      requested: { ...request.profile.versions },
      resolved: null,
    },
    runtime: createRuntimeEvidence(request.profile),
    stages: [],
  }
}

function validateNodeRuntime(profile) {
  if (!parseExactSemver(profile?.nodeVersion)) {
    throw new Error(
      `Version Profile ${profile?.id ?? '<unknown>'} must declare one exact Node runtime`,
    )
  }
  if (profile.nodeVersion !== process.versions.node) {
    throw new Error(
      `Node runtime mismatch for Version Profile ${profile.id}: requested ${profile.nodeVersion}, observed ${process.versions.node}`,
    )
  }
}

function createRegistrySmokeEvidence(request) {
  return {
    schemaVersion: 1,
    success: false,
    mode: 'registry-smoke',
    package: {
      name: request.packageName,
      requestedVersion: request.packageVersion,
      resolvedVersion: null,
    },
    profile: {
      id: request.profile.id,
      requested: { ...request.profile.versions },
      resolved: null,
    },
    runtime: createRuntimeEvidence(request.profile),
    stages: [],
  }
}

function validateRequest(request, supportedKinds = ['pack']) {
  if (!supportedKinds.includes(request.packageSource.kind)) {
    throw new Error(`Unsupported package source: ${request.packageSource.kind}`)
  }
  if (request.packageSource.kind === 'retained' && !request.packageSource.artifact) {
    throw new Error('Retained package source requires an artifact')
  }
}

function validateRegistrySmokeRequest(request) {
  if (!parseExactSemver(request.packageVersion)) {
    throw new Error('Registry smoke requires an exact package version')
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

function markRemainingStagesSkipped(
  evidence,
  failedStage,
  stageNames = VERIFICATION_STAGES,
) {
  const failedIndex = stageNames.indexOf(failedStage)
  for (const name of stageNames.slice(failedIndex + 1)) {
    evidence.stages.push({
      name,
      status: 'skipped',
      reason: `required stage ${failedStage} failed`,
    })
  }
}

function createMatrixEvidence() {
  return {
    schemaVersion: 1,
    success: false,
    mode: 'package-artifact-matrix',
    package: null,
    artifact: null,
    profiles: [],
    stages: [],
  }
}

function createMatrixProfileEvidence(profile) {
  return {
    id: profile.id,
    success: false,
    requested: { ...profile.versions },
    resolved: null,
    runtime: createRuntimeEvidence(profile),
    stages: [],
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

async function runConsumerVerificationPlan({
  artifact,
  evidence,
  operations,
  packageEvidence,
  packageSource,
  plan,
  profile,
  profileEvidence,
  validateRuntime = true,
  workspace: initialWorkspace,
}) {
  let workspace = initialWorkspace
  let primaryFailure
  const stageNames = CONSUMER_VERIFICATION_PLANS[plan]
  const activeStageNames = validateRuntime
    ? ['node-runtime', ...stageNames]
    : stageNames

  try {
    if (validateRuntime) {
      await runStage(evidence, 'node-runtime', () => validateNodeRuntime(profile))
    }
    const installation = await runStage(evidence, 'install', async () => {
      workspace ??= await operations.createWorkspace()
      return operations.installConsumer({
        packageSource,
        consumerDirectory: workspace.consumerDirectory,
        profile,
      })
    })
    profileEvidence.resolved = installation.profileVersions
    if (packageEvidence) packageEvidence.resolvedVersion = installation.packageVersion

    for (const stage of stageNames.slice(1)) {
      if (stage === 'exports') {
        await runStage(evidence, stage, () => operations.verifyPackageExports({
          artifact,
          consumerDirectory: workspace.consumerDirectory,
        }))
      }
      else if (stage === 'types') {
        await runStage(evidence, stage, () => operations.verifyTypes({
          consumerDirectory: workspace.consumerDirectory,
        }))
      }
      else if (stage === 'build') {
        await runStage(evidence, stage, () => operations.buildConsumer({
          consumerDirectory: workspace.consumerDirectory,
        }))
      }
      else if (stage === 'runtime') {
        await runStage(evidence, stage, () => operations.smokeRuntime({
          consumerDirectory: workspace.consumerDirectory,
        }))
      }
    }
  }
  catch (error) {
    primaryFailure = error instanceof StageExecutionFailure
      ? error
      : new StageExecutionFailure('install', error)
    markRemainingStagesSkipped(
      evidence,
      primaryFailure.stage,
      activeStageNames,
    )
  }

  const cleanupFailure = await cleanupVerificationWorkspace(evidence, workspace, operations)
  return primaryFailure ?? cleanupFailure
}

async function runMatrixProfile(artifact, profile, operations) {
  const evidence = createMatrixProfileEvidence(profile)
  const failure = await runConsumerVerificationPlan({
    artifact,
    evidence,
    operations,
    packageSource: { kind: 'artifact', artifact },
    plan: 'artifact',
    profile,
    profileEvidence: evidence,
  })

  evidence.success = !failure
  return { evidence, failure }
}

function createSkippedMatrixProfileEvidence(profile, failedStage) {
  const evidence = createMatrixProfileEvidence(profile)
  for (const name of CONSUMER_VERIFICATION_PLANS.artifact) {
    evidence.stages.push({
      name,
      status: 'skipped',
      reason: `required matrix stage ${failedStage} failed`,
    })
  }
  evidence.stages.push({
    name: 'cleanup',
    status: 'skipped',
    reason: 'temporary workspace was not created',
  })
  return evidence
}

export async function runPackageArtifactMatrixVerification(request, operations) {
  validateRequest(request)
  if (!Array.isArray(request.profiles) || request.profiles.length === 0) {
    throw new Error('Compatibility matrix requires at least one Version Profile')
  }
  const profileIds = request.profiles.map(profile => profile.id)
  if (new Set(profileIds).size !== profileIds.length) {
    throw new Error('Compatibility matrix contains duplicate Version Profiles')
  }

  const evidence = createMatrixEvidence()
  const failures = []
  let artifactWorkspace
  let artifact
  let matrixFailure

  try {
    artifact = await runStage(evidence, 'artifact', async () => {
      artifactWorkspace = await operations.createWorkspace()
      return operations.createArtifact({
        repositoryRoot: request.packageSource.repositoryRoot,
        artifactDirectory: artifactWorkspace.artifactDirectory,
      })
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
      archiveDirectory: artifactWorkspace.archiveDirectory,
      artifact,
    }))
  }
  catch (error) {
    matrixFailure = error instanceof StageExecutionFailure
      ? error
      : new StageExecutionFailure('artifact', error)
    failures.push({
      profileId: null,
      stage: matrixFailure.stage,
      cause: matrixFailure.cause,
    })
  }

  if (matrixFailure) {
    evidence.profiles.push(...request.profiles.map(profile => (
      createSkippedMatrixProfileEvidence(profile, matrixFailure.stage)
    )))
  }
  else {
    for (const profile of request.profiles) {
      const result = await runMatrixProfile(artifact, profile, operations)
      evidence.profiles.push(result.evidence)
      if (result.failure) {
        failures.push({
          profileId: profile.id,
          stage: result.failure.stage,
          cause: result.failure.cause,
        })
      }
    }
  }

  const cleanupFailure = await cleanupVerificationWorkspace(
    evidence,
    artifactWorkspace,
    operations,
  )
  if (cleanupFailure) {
    failures.push({
      profileId: null,
      stage: cleanupFailure.stage,
      cause: cleanupFailure.cause,
    })
  }

  if (failures.length > 0) {
    throw new CompatibilityMatrixVerificationFailure(failures, evidence)
  }

  evidence.success = true
  return evidence
}

export async function runPackageArtifactVerification(request, operations) {
  validateRequest(request, ['pack', 'retained'])

  const evidence = createEvidence(request)
  let workspace
  let primaryFailure
  let artifact

  try {
    await runStage(evidence, 'node-runtime', () => validateNodeRuntime(request.profile))
    artifact = await runStage(evidence, 'artifact', async () => {
      workspace = await operations.createWorkspace()
      if (request.packageSource.kind === 'retained') {
        return request.packageSource.artifact
      }
      return operations.createArtifact({
        repositoryRoot: request.packageSource.repositoryRoot,
        artifactDirectory: workspace.artifactDirectory,
      })
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
    : await runConsumerVerificationPlan({
        artifact,
        evidence,
        operations,
        packageSource: { kind: 'artifact', artifact },
        plan: 'artifact',
        profile: request.profile,
        profileEvidence: evidence.profile,
        validateRuntime: false,
        workspace,
      })

  const failure = primaryFailure ?? consumerFailure
  if (failure) {
    throw new ReleaseVerificationFailure(failure.stage, failure.cause, evidence)
  }

  evidence.success = true
  return evidence
}

export async function runRegistrySmokeVerification(request, operations) {
  validateRegistrySmokeRequest(request)

  const evidence = createRegistrySmokeEvidence(request)
  const failure = await runConsumerVerificationPlan({
    evidence,
    operations,
    packageEvidence: evidence.package,
    packageSource: {
      kind: 'registry',
      packageName: request.packageName,
      packageVersion: request.packageVersion,
    },
    plan: 'registry',
    profile: request.profile,
    profileEvidence: evidence.profile,
  })

  if (failure) {
    throw new RegistrySmokeVerificationFailure(failure.stage, failure.cause, evidence)
  }

  evidence.success = true
  return evidence
}
