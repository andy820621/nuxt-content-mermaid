export interface VersionProfile {
  id: string
  versions: {
    betterSqlite3: string
    nuxt: string
    nuxtContent: string
    mermaid: string
    typescript: string
    vueTsc: string
  }
}

export interface PackageArtifact {
  archivePath: string
  filename: string
  sha256: string
  packageName: string
  packageVersion: string
}

export interface VerificationWorkspace {
  root: string
  artifactDirectory: string
  archiveDirectory: string
  consumerDirectory: string
}

export type VerificationStageName
  = | 'artifact'
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
  }
  stages: VerificationStageEvidence[]
}

export interface PackageArtifactVerificationRequest {
  packageSource: {
    kind: 'pack'
    repositoryRoot: string
  }
  profile: VersionProfile
}

export interface ReleaseVerificationOperations {
  createWorkspace: () => Promise<VerificationWorkspace>
  createArtifact: (input: {
    repositoryRoot: string
    artifactDirectory: string
  }) => Promise<PackageArtifact>
  inspectArchive: (input: {
    archiveDirectory: string
    artifact: PackageArtifact
  }) => Promise<void>
  installConsumer: (input: {
    artifact: PackageArtifact
    consumerDirectory: string
    profile: VersionProfile
  }) => Promise<VersionProfile['versions']>
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
  readonly stage: VerificationStageName
  readonly cause: unknown
  readonly evidence: PackageArtifactEvidence
}

export function runPackageArtifactVerification(
  request: PackageArtifactVerificationRequest,
  operations: ReleaseVerificationOperations,
): Promise<PackageArtifactEvidence>
