import type {
  PackageArtifactEvidence,
  PackageArtifactMatrixEvidence,
  ReleaseVerificationOperations,
  VersionProfile,
} from './runner.mjs'
import type { CommandInvocation, CommandResult } from './release.mjs'

export interface FreshLatestProfileResolution {
  requested: Record<string, string>
  resolved: VersionProfile['versions']
  profile: VersionProfile
}

export interface CompatibilityDriftFailureEvidence {
  classification: 'confirmed-drift'
    | 'infrastructure'
    | 'unconfirmed-package-user-failure'
  stage: string
  message: string
  profileId?: string
}

export interface CompatibilityDriftEvidence {
  schemaVersion: 1
  status: 'passed' | 'confirmed-drift' | 'infrastructure-failure' | 'needs-investigation'
  sourceCommit: string | null
  resolutions: Array<Pick<FreshLatestProfileResolution, 'requested' | 'resolved'>>
  initial: PackageArtifactMatrixEvidence | null
  retries?: Array<{
    profile: VersionProfile
    evidence: PackageArtifactEvidence | null
    status: 'passed' | 'failed'
    stage?: string
    message?: string
  }>
  failure: CompatibilityDriftFailureEvidence | null
  rerun?: { command: string }
}

export interface CompatibilityDriftRetryEvidence {
  schemaVersion: 1
  status: 'retry-passed' | 'retry-failed'
  sourceCommit: string
  profile: VersionProfile
  result: PackageArtifactEvidence | null
  failure?: {
    classification: 'package-user-failure' | 'infrastructure'
    stage: string
    message: string
  }
}

export class CompatibilityDriftFailure extends Error {
  constructor(
    evidence: CompatibilityDriftEvidence | CompatibilityDriftRetryEvidence,
    cause?: unknown,
  )
  readonly cause: unknown
  readonly evidence: CompatibilityDriftEvidence | CompatibilityDriftRetryEvidence
}

export function parseCompatibilityDriftArguments(argv: string[]):
  | { mode: 'scheduled' }
  | { mode: 'retry', profile: VersionProfile, sourceCommit: string }

export function runCompatibilityDriftCheck(input: {
  repositoryRoot: string
  sourceCommit: string
  resolveProfiles: () => Promise<FreshLatestProfileResolution[]>
  operations: ReleaseVerificationOperations
  runners: {
    matrix: (input: {
      packageSource: { kind: 'pack', repositoryRoot: string }
      profiles: VersionProfile[]
    }, operations: ReleaseVerificationOperations) => Promise<PackageArtifactMatrixEvidence>
    single: (input: {
      packageSource: { kind: 'pack', repositoryRoot: string }
      profile: VersionProfile
    }, operations: ReleaseVerificationOperations) => Promise<PackageArtifactEvidence>
  }
}): Promise<CompatibilityDriftEvidence>

export function runCompatibilityDriftCli(input?: {
  argv?: string[]
  repositoryRoot?: string
  sourceCommit?: string
  commandRunner?: (invocation: CommandInvocation) => Promise<CommandResult>
  resolveProfiles?: () => Promise<FreshLatestProfileResolution[]>
  operations?: ReleaseVerificationOperations
  runners?: {
    matrix: (input: {
      packageSource: { kind: 'pack', repositoryRoot: string }
      profiles: VersionProfile[]
    }, operations: ReleaseVerificationOperations) => Promise<PackageArtifactMatrixEvidence>
    single: (input: {
      packageSource: { kind: 'pack', repositoryRoot: string }
      profile: VersionProfile
    }, operations: ReleaseVerificationOperations) => Promise<PackageArtifactEvidence>
  }
  writeEvidence?: (evidence: CompatibilityDriftEvidence | CompatibilityDriftRetryEvidence) => void
}): Promise<CompatibilityDriftEvidence | CompatibilityDriftRetryEvidence>
