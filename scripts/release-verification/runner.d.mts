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
  integritySha512: string
  packlist: string[]
  packageName: string
  packageVersion: string
  packageContract?: {
    node: string
    nuxt: string
    nuxtContent: string
    nuxtKit: string
    mermaid: string
  }
}

export type ConsumerPackageSource
  = | { kind: 'artifact', artifact: PackageArtifact }
    | {
      kind: 'registry'
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

export interface RegistrySmokeVerificationRequest {
  packageName: string
  packageVersion: string
  profile: VersionProfile
}

export interface RegistrySmokeVerificationEvidence {
  schemaVersion: 1
  success: boolean
  mode: 'registry-smoke'
  package: {
    name: string
    requestedVersion: string
    resolvedVersion: string | null
  }
  profile: {
    id: string
    requested: VersionProfile['versions']
    resolved: VersionProfile['versions'] | null
    expectedResolutions?: ExpectedResolutionEvidence
  }
  runtime: PackageArtifactEvidence['runtime']
  stages: VerificationStageEvidence[]
}

export interface PackageArtifactVerificationRequest {
  packageSource: {
    kind: 'artifact'
    artifact: PackageArtifact
  }
  profile: VersionProfile
}

export interface PackageArtifactMatrixVerificationRequest {
  artifact: PackageArtifact
  profiles: readonly VersionProfile[]
}

export type PackageArtifactProfileVerifier = (input: {
  artifact: PackageArtifact
  profile: VersionProfile
}) => Promise<PackageArtifactEvidence>

export interface CompatibilityMatrixProfileEvidence {
  id: string
  success: boolean
  requested: VersionProfile['versions']
  resolved: null | VersionProfile['versions']
  expectedResolutions?: ExpectedResolutionEvidence
  runtime: PackageArtifactEvidence['runtime']
  stages: VerificationStageEvidence[]
}

export interface PackageArtifactMatrixEvidence {
  schemaVersion: 1
  success: boolean
  mode: 'package-artifact-matrix'
  package: PackageArtifactEvidence['package']
  artifact: PackageArtifactEvidence['artifact']
  profiles: CompatibilityMatrixProfileEvidence[]
  stages: VerificationStageEvidence[]
}

export interface CompatibilityMatrixFailure {
  profileId: string | null
  stage: VerificationStageName
  cause: unknown
}

export interface ReleaseVerificationOperations {
  createWorkspace: () => Promise<VerificationWorkspace>
  createArtifact: (input: {
    repositoryRoot: string
    artifactDirectory: string
  }) => Promise<PackageArtifact>
  loadArtifact: (input: {
    archivePath: string
    checksumPath: string
  }) => Promise<PackageArtifact>
  inspectArchive: (input: {
    archiveDirectory: string
    artifact: PackageArtifact
  }) => Promise<void>
  installConsumer: (input: {
    packageSource: ConsumerPackageSource
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

export class RegistrySmokeVerificationFailure extends Error {
  constructor(
    stage: VerificationStageName,
    cause: unknown,
    evidence: RegistrySmokeVerificationEvidence,
  )
  readonly stage: VerificationStageName
  readonly cause: unknown
  readonly evidence: RegistrySmokeVerificationEvidence
}

export class CompatibilityMatrixVerificationFailure extends Error {
  constructor(
    failures: CompatibilityMatrixFailure[],
    evidence: PackageArtifactMatrixEvidence,
  )
  readonly failures: CompatibilityMatrixFailure[]
  readonly evidence: PackageArtifactMatrixEvidence
}

export function runPackageArtifactVerification(
  request: PackageArtifactVerificationRequest,
  operations: ReleaseVerificationOperations,
): Promise<PackageArtifactEvidence>

export function runPackageArtifactMatrixVerification(
  request: PackageArtifactMatrixVerificationRequest,
  verifyProfile: PackageArtifactProfileVerifier,
): Promise<PackageArtifactMatrixEvidence>

export function runRegistrySmokeVerification(
  request: RegistrySmokeVerificationRequest,
  operations: ReleaseVerificationOperations,
): Promise<RegistrySmokeVerificationEvidence>
