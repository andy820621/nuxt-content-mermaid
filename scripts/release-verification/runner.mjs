const VERIFICATION_STAGES = [
  'artifact',
  'archive',
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

function markRemainingStagesSkipped(evidence, failedStage) {
  const failedIndex = VERIFICATION_STAGES.indexOf(failedStage)
  for (const name of VERIFICATION_STAGES.slice(failedIndex + 1)) {
    evidence.stages.push({
      name,
      status: 'skipped',
      reason: `required stage ${failedStage} failed`,
    })
  }
}

export async function runPackageArtifactVerification(request, operations) {
  validateRequest(request)

  const evidence = createEvidence(request)
  let workspace
  let primaryFailure

  try {
    const artifact = await runStage(evidence, 'artifact', async () => {
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

    evidence.profile.resolved = await runStage(evidence, 'install', () => operations.installConsumer({
      artifact,
      consumerDirectory: workspace.consumerDirectory,
      profile: request.profile,
    }))

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
      : new StageExecutionFailure('artifact', error)
    markRemainingStagesSkipped(evidence, primaryFailure.stage)
  }

  let cleanupFailure
  if (workspace) {
    try {
      await runStage(evidence, 'cleanup', () => operations.cleanupWorkspace(workspace.root))
    }
    catch (error) {
      cleanupFailure = error
    }
  }
  else {
    evidence.stages.push({
      name: 'cleanup',
      status: 'skipped',
      reason: 'temporary workspace was not created',
    })
  }

  const failure = primaryFailure ?? cleanupFailure
  if (failure) {
    throw new ReleaseVerificationFailure(failure.stage, failure.cause, evidence)
  }

  evidence.success = true
  return evidence
}
