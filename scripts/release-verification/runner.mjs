const VERIFICATION_STAGES = [
  'artifact',
  'archive',
  'install',
  'exports',
  'types',
  'build',
  'runtime',
]
const PROFILE_VERIFICATION_STAGES = [
  'install',
  'exports',
  'types',
  'build',
  'runtime',
]

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
    stages: [],
  }
}

function validateRequest(request) {
  if (request.packageSource.kind !== 'pack') {
    throw new Error(`Unsupported package source: ${request.packageSource.kind}`)
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

async function runConsumerContract({
  artifact,
  evidence,
  operations,
  profile,
  profileEvidence,
  workspace: initialWorkspace,
}) {
  let workspace = initialWorkspace
  let primaryFailure

  try {
    profileEvidence.resolved = await runStage(evidence, 'install', async () => {
      workspace ??= await operations.createWorkspace()
      return operations.installConsumer({
        artifact,
        consumerDirectory: workspace.consumerDirectory,
        profile,
      })
    })
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
    markRemainingStagesSkipped(
      evidence,
      primaryFailure.stage,
      PROFILE_VERIFICATION_STAGES,
    )
  }

  const cleanupFailure = await cleanupVerificationWorkspace(evidence, workspace, operations)
  return primaryFailure ?? cleanupFailure
}

async function runMatrixProfile(artifact, profile, operations) {
  const evidence = createMatrixProfileEvidence(profile)
  const failure = await runConsumerContract({
    artifact,
    evidence,
    operations,
    profile,
    profileEvidence: evidence,
  })

  evidence.success = !failure
  return { evidence, failure }
}

function createSkippedMatrixProfileEvidence(profile, failedStage) {
  const evidence = createMatrixProfileEvidence(profile)
  for (const name of PROFILE_VERIFICATION_STAGES) {
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
  validateRequest(request)

  const evidence = createEvidence(request)
  let workspace
  let primaryFailure
  let artifact

  try {
    artifact = await runStage(evidence, 'artifact', async () => {
      workspace = await operations.createWorkspace()
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
    : await runConsumerContract({
        artifact,
        evidence,
        operations,
        profile: request.profile,
        profileEvidence: evidence.profile,
        workspace,
      })

  const failure = primaryFailure ?? consumerFailure
  if (failure) {
    throw new ReleaseVerificationFailure(failure.stage, failure.cause, evidence)
  }

  evidence.success = true
  return evidence
}
