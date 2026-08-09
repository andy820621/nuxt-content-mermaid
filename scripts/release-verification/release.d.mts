import type {
  CompatibilityMatrixProfileEvidence,
  PackageArtifact,
  PackageArtifactMatrixEvidence,
  RegistrySmokeVerificationEvidence,
  RegistrySmokeVerificationRequest,
  ReleaseVerificationOperations,
  VersionProfile,
  runPackageArtifactMatrixVerification,
  runRegistrySmokeVerification,
} from './runner.mjs'
import type { RegistryHealthEvidence } from './registry-smoke.mjs'

export interface ReleaseRequest {
  mode: 'release'
  targetVersion: string
  skipManualReason: string | null
}

export interface ReconciliationRequest {
  mode: 'reconcile'
  targetVersion: string
}

export interface RegistrySmokeRetryRequest {
  mode: 'registry-smoke-retry'
  targetVersion: string
}

export interface ReleaseIdentity {
  sourceCommit: string
  targetVersion: string
  artifactIntegritySha512: string
}

export interface ReleaseManifestSnapshot {
  engines: { node: string }
  peerDependencies: {
    '@nuxt/content': string
    'nuxt': string
  }
  dependencies: {
    '@nuxt/kit': string
    'mermaid': string
  }
}

export interface ReleaseBaseline {
  manifest: ReleaseManifestSnapshot
  profiles: VersionProfile[]
}

export type ManualCheckName
  = | 'fullscreen'
    | 'zoomPanDrag'
    | 'clipboard'
    | 'mobileInteraction'
    | 'visualReadability'

export interface LeanReleaseEvidence {
  schemaVersion: 1
  status: 'preparing' | 'blocked' | 'verified' | 'pushed' | 'published'
  changeHeadCommit: string
  sourceChecks: null | {
    command: 'pnpm verify:source'
    passed: boolean
    completedAt: string
  }
  identity: ReleaseIdentity | null
  artifact?: {
    archivePath: string
    filename: string
    sha256: string
    packageName: string
    packageVersion: string
    packlist: string[]
  }
  releaseBaseline: ReleaseBaseline | null
  compatibilityProfiles: CompatibilityMatrixProfileEvidence[]
  manualCheck: null | {
    required: boolean
    reason: string
    results: Record<string, boolean> | null
  }
  timestamps: Record<string, string>
  blocked?: {
    stage: string
    message: string
  }
  registryHealth?: RegistryHealthEvidence
}

export interface CommandInvocation {
  command: string
  args: string[]
  cwd: string
  env?: Record<string, string>
}

export interface CommandResult {
  stdout?: string
  stderr?: string
}

export interface ReleaseEffects {
  now: () => string
  runCommand: (invocation: CommandInvocation) => Promise<CommandResult>
  initializeEvidence: (evidence: LeanReleaseEvidence) => Promise<void>
  writeEvidence: (evidence: LeanReleaseEvidence) => Promise<void>
  readEvidence: (input: {
    repositoryRoot: string
    targetVersion: string
  }) => Promise<LeanReleaseEvidence>
  readRepositoryState: (input: { repositoryRoot: string }) => Promise<{
    branch: string
    clean: boolean
    head: string
    packageName: string
    packageVersion: string
  }>
  readPublishedVersion: (input: {
    packageName: string
    targetVersion: string
  }) => Promise<string | null>
  readRegistryRelease: (input: {
    packageName: string
    targetVersion: string
  }) => Promise<
    | { state: 'absent' }
    | { state: 'published', integrity: string }
  >
  prepareRelease: (input: {
    changeHeadCommit: string
    repositoryRoot: string
    targetVersion: string
  }) => Promise<{
    sourceCommit: string
    artifact: PackageArtifact
  }>
  readReleaseManifestSnapshot: (input: {
    artifact: PackageArtifact
  }) => Promise<ReleaseManifestSnapshot>
  verifyArtifactProfiles: (input: {
    artifact: PackageArtifact
    profiles: VersionProfile[]
  }) => Promise<PackageArtifactMatrixEvidence>
  verifyRegistryPackage: (
    request: RegistrySmokeVerificationRequest,
  ) => Promise<RegistrySmokeVerificationEvidence>
  runManualCheck: (input: {
    artifact: PackageArtifact
    profile: VersionProfile
    checks: ManualCheckName[]
  }) => Promise<Record<string, boolean>>
  assertReleaseIdentity: (input: {
    phase: 'fast-forward' | 'tag' | 'push' | 'publish' | 'reconcile'
    repositoryRoot: string
    changeHeadCommit: string
    identity: ReleaseIdentity
    artifact: PackageArtifact
    releaseBaseline: ReleaseBaseline
    tagName: string
  }) => Promise<void>
  fastForward: (input: {
    repositoryRoot: string
    sourceCommit: string
  }) => Promise<void>
  createTag: (input: {
    repositoryRoot: string
    sourceCommit: string
    tagName: string
  }) => Promise<CommandResult>
  push: (input: {
    branch: string
    repositoryRoot: string
    tagName: string
  }) => Promise<CommandResult>
  publish: (input: {
    archivePath: string
    distTag: string
  }) => Promise<CommandResult>
}

export interface CreateReleaseEffectsOptions {
  artifactCreator?: ReleaseVerificationOperations['createArtifact']
  clock?: () => Date
  commandRunner?: (invocation: CommandInvocation) => Promise<CommandResult>
  filesystem?: Partial<{
    mkdir: (path: string, options?: { recursive?: boolean }) => Promise<unknown>
    mkdtemp: (prefix: string) => Promise<string>
    readFile: (
      path: string,
      encoding?: BufferEncoding,
    ) => Promise<string | Uint8Array>
    rename: (oldPath: string, newPath: string) => Promise<void>
    rm: (
      path: string,
      options: { recursive: true, force: true },
    ) => Promise<void>
    writeFile: (path: string, data: string, encoding: BufferEncoding) => Promise<void>
  }>
  manualInteractionRunner?: (input: {
    checks: ManualCheckName[]
    consumerDirectory: string
  }) => Promise<Record<string, boolean>>
  matrixVerifier?: typeof runPackageArtifactMatrixVerification
  profileProcessRunner?: (invocation: {
    command: string
    args: string[]
    cwd: string
  }) => Promise<void>
  registryVerifier?: typeof runRegistrySmokeVerification
  repositoryRoot?: string
  targetVersion?: string
  temporaryRoot?: string
  verificationOperations?: ReleaseVerificationOperations
}

export function createReleaseEffects(
  options?: CreateReleaseEffectsOptions,
): ReleaseEffects

export function parseReleaseArguments(
  argv: string[],
): ReleaseRequest | ReconciliationRequest | RegistrySmokeRetryRequest

export function runReleaseGate(input: {
  request: ReleaseRequest
  repositoryRoot: string
  effects: ReleaseEffects
}): Promise<LeanReleaseEvidence>

export function runReleaseReconciliation(input: {
  request: ReconciliationRequest
  repositoryRoot: string
  effects: ReleaseEffects
}): Promise<LeanReleaseEvidence>

export function runReleaseRegistrySmokeRetry(input: {
  request: RegistrySmokeRetryRequest
  repositoryRoot: string
  effects: ReleaseEffects
}): Promise<LeanReleaseEvidence>

export function runReleaseCli(input?: {
  argv?: string[]
  effectFactory?: (options: {
    repositoryRoot: string
    targetVersion: string
  }) => ReleaseEffects
  repositoryRoot?: string
}): Promise<LeanReleaseEvidence>
