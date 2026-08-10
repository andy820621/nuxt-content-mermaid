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

export interface WorkflowReleaseRequest {
  targetVersion: string
  sourceCommit?: string
  eventName?: string
  ref?: string
  archivePath?: string
  checksumPath?: string
  integritySha512?: string
  repositoryRoot?: string
  artifactDirectory?: string
}

export function runPreflight(input: {
  request: WorkflowReleaseRequest
  effects: object
}): Promise<unknown>

export function runNpmPublish(input: {
  request: WorkflowReleaseRequest
  effects: object
  maxAttempts?: number
}): Promise<unknown>

export function runRegistrySmoke(input: {
  request: WorkflowReleaseRequest
  effects: object
}): Promise<unknown>

export function runFinalize(input: {
  request: WorkflowReleaseRequest
  effects: object
}): Promise<unknown>

export function runPack(input: {
  request: WorkflowReleaseRequest
  effects: object
}): Promise<unknown>

export function createReleaseWorkflowEffects(options?: {
  repositoryRoot?: string
  commandRunner?: (input: object) => Promise<object | undefined>
  fetcher?: typeof fetch
  environment?: Record<string, string | undefined>
}): object

export function parseReleaseWorkflowArguments(
  argv: string[],
): { command: string } & Record<string, string>

export function runReleaseWorkflowCli(input: {
  argv: string[]
  repositoryRoot: string
  effects?: object
  environment?: Record<string, string | undefined>
}): Promise<unknown>
