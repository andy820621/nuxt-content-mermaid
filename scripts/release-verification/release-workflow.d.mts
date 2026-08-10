export type ReleaseImpact = 'affected' | 'unaffected' | 'uncertain'

export type ReleaseImpactDimension
  = | 'package contents'
    | 'runtime behavior'
    | 'interaction'
    | 'styling/layout'
    | 'browser APIs'
    | 'runtime dependencies'

export interface ReleaseImpactEntry {
  impact: ReleaseImpact
  evidence: string
}

export interface ReleasePullRequestValidationInput {
  body?: string
  baseVersion: string
  headVersion: string
}

export type ReleasePullRequestValidation = {
  isReleasePullRequest: false
} | {
  isReleasePullRequest: true
  targetVersion: string
  impactDeclaration: Record<ReleaseImpactDimension, ReleaseImpactEntry>
  manualInteractionVerificationRequired: boolean
}

export const RELEASE_IMPACT_DIMENSIONS: readonly ReleaseImpactDimension[]

export function validateReleasePullRequest(
  input: ReleasePullRequestValidationInput,
): ReleasePullRequestValidation

export function extractChangelogSection(
  changelog: string,
  targetVersion: string,
): string

export interface PreflightReleaseRequest {
  targetVersion: string
  sourceCommit: string
  eventName: string
  ref: string
}

export interface NpmPublishReleaseRequest {
  targetVersion: string
  archivePath: string
  checksumPath: string
}

export interface RegistrySmokeReleaseRequest {
  targetVersion: string
  integritySha512: string
}

export interface FinalizeReleaseRequest {
  targetVersion: string
  sourceCommit: string
}

export interface PackReleaseRequest {
  targetVersion: string
  repositoryRoot: string
  artifactDirectory: string
}

export function runPreflight(input: {
  request: PreflightReleaseRequest
  effects: object
}): Promise<unknown>

export function runNpmPublish(input: {
  request: NpmPublishReleaseRequest
  effects: object
  maxAttempts?: number
}): Promise<unknown>

export function runRegistrySmoke(input: {
  request: RegistrySmokeReleaseRequest
  effects: object
}): Promise<unknown>

export function runFinalize(input: {
  request: FinalizeReleaseRequest
  effects: object
}): Promise<unknown>

export function runPack(input: {
  request: PackReleaseRequest
  effects: object
}): Promise<unknown>

export function createReleaseWorkflowEffects(options?: {
  repositoryRoot?: string
  commandRunner?: (input: object) => Promise<object | undefined>
  fetcher?: typeof fetch
  environment?: Record<string, string | undefined>
}): object

export type ReleaseWorkflowCliRequest
  = | { 'command': 'validate-pr', 'event-path': string }
    | { command: 'preflight', version: string }
    | { 'command': 'pack', 'artifact-directory': string, 'version': string }
    | { command: 'publish', archive: string, checksum: string, version: string }
    | { command: 'registry-smoke', integrity: string, version: string }
    | { command: 'finalize', sha: string, version: string }

export function parseReleaseWorkflowArguments(argv: string[]): ReleaseWorkflowCliRequest

export function runReleaseWorkflowCli(input: {
  argv: string[]
  repositoryRoot: string
  effects?: object
  environment?: Record<string, string | undefined>
}): Promise<unknown>
