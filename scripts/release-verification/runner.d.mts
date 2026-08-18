export interface ExpectedResolutions {
  nuxtKit: string
  nuxtSchema: string
}

export interface VersionProfile {
  id: string
  nodeVersion: string
  versions: {
    betterSqlite3: string
    nuxt: string
    nuxtContent: string
    mermaid: string
    typescript: string
    vueTsc: string
  }
  expectedResolutions?: ExpectedResolutions
}

export interface PackageArtifact {
  archivePath: string
  filename: string
  sha256: string
  packlist: string[]
  packageName: string
  packageVersion: string
}

export interface ConsumerInstallResult {
  packageVersion: string
  profileVersions: VersionProfile['versions']
  expectedResolutions?: ExpectedResolutions
}

export interface VerificationWorkspace {
  root: string
  artifactDirectory: string
  archiveDirectory: string
  consumerDirectory: string
}

export type VerificationStageName
  = | 'node-runtime'
    | 'artifact'
    | 'archive'
    | 'install'
    | 'exports'
    | 'types'
    | 'build'
    | 'runtime'
    | 'cleanup'

export interface VerificationStageEvidence {
  name: VerificationStageName
  status: 'passed' | 'failed' | 'skipped'
  durationMs?: number
  error?: string
  reason?: string
}

export interface ExpectedResolutionEvidence {
  requested: ExpectedResolutions
  resolved: ExpectedResolutions | null
}

export interface PackageArtifactEvidence {
  schemaVersion: 1
  success: boolean
  mode: 'package-artifact'
  package: null | {
    name: string
    version: string
  }
  artifact: null | {
    filename: string
    sha256: string
  }
  profile: {
    id: string
    requested: VersionProfile['versions']
    resolved: null | VersionProfile['versions']
    expectedResolutions?: ExpectedResolutionEvidence
  }
  runtime: {
    requested: string | null
    observed: string
  }
  stages: VerificationStageEvidence[]
}

export interface PackageArtifactVerificationRequest {
  artifact: PackageArtifact
  profile: VersionProfile
}

export interface ReleaseVerificationOperations {
  createWorkspace: () => Promise<VerificationWorkspace>
  inspectArchive: (input: {
    archiveDirectory: string
    artifact: PackageArtifact
  }) => Promise<void>
  installConsumer: (input: {
    artifact: PackageArtifact
    consumerDirectory: string
    profile: VersionProfile
  }) => Promise<ConsumerInstallResult>
  verifyPackageExports: (input: {
    artifact: PackageArtifact
    consumerDirectory: string
  }) => Promise<void>
  verifyTypes: (input: { consumerDirectory: string }) => Promise<void>
  buildConsumer: (input: { consumerDirectory: string }) => Promise<void>
  smokeRuntime: (input: { consumerDirectory: string }) => Promise<void>
  cleanupWorkspace: (workspaceRoot: string) => Promise<void>
}

export class ReleaseVerificationFailure extends Error {
  constructor(
    stage: VerificationStageName,
    cause: unknown,
    evidence: PackageArtifactEvidence,
  )
  readonly stage: VerificationStageName
  readonly cause: unknown
  readonly evidence: PackageArtifactEvidence
}

export function runPackageArtifactVerification(
  request: PackageArtifactVerificationRequest,
  operations: ReleaseVerificationOperations,
): Promise<PackageArtifactEvidence>
