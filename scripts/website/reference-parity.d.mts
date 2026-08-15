export type ReferenceMismatchCategory
  = | 'artifact-version-mismatch'
    | 'conditional-mismatch'
    | 'default-mismatch'
    | 'delegated-descendant'
    | 'deprecation-mismatch'
    | 'duplicate-fragment'
    | 'duplicate-path'
    | 'evidence-escape'
    | 'exception-mismatch'
    | 'extra-fragment'
    | 'extra-path'
    | 'missing-fragment'
    | 'missing-path'
    | 'missing-required-prose'
    | 'precedence-mismatch'
    | 'runtime-only-enabled'
    | 'snippet-failure'
    | 'type-mismatch'
    | 'unreadable-verification-infrastructure'
    | 'unsupported-constraint-evidence'
    | 'workspace-source-evidence'

export interface ReferenceMismatch {
  category: ReferenceMismatchCategory
  path?: string
  fragment?: string
  field?: string
}

export interface VerifiedArtifactIdentity {
  phase: string
  artifactRoot: string
  manifestPath: string
  moduleEntryPath?: string
  packageMetadata: {
    name: string
    version: string
    exports?: unknown
    types?: unknown
    typesVersions?: unknown
  }
  version: string
}

declare const artifactEvidenceIdentifier: unique symbol
export type ArtifactEvidenceIdentifier = `artifact:${string}#${string}` & {
  readonly [artifactEvidenceIdentifier]: true
}

interface ReferenceRecordBase {
  artifactVersion: string
  description: string
  evidence: readonly ArtifactEvidenceIdentifier[]
  fragment: string
  path: string
  title: string
  purpose: string
  ownership: string
  occurrences: readonly ReferenceOccurrence[]
  scope: string
  boundary: string
  deprecation: Readonly<{
    status: 'active' | 'deprecated-accepted-no-op' | 'rejected' | 'outside-inventory'
    summary: string
  }>
  explicitNegatives?: readonly string[]
}

export interface ReferenceOccurrence {
  surface: string
  path: string
  scope: string
  precedence: string
}

export interface ReferenceSummary<K extends string> {
  kind: K
  summary: string
  value?: unknown
  outcomes?: Readonly<Record<string, unknown>>
}

export interface ReferenceMinimumExample {
  id: string
  language: 'typescript' | 'markdown'
  source: string
}

interface ConfigurationSemantics {
  precedence: readonly string[]
  default?: ReferenceSummary<'literal' | 'conditional' | 'inherited' | 'omitted'>
  reset?: ReferenceSummary<'value' | 'omission' | 'none'>
  minimumExample?: ReferenceMinimumExample
  lifecycle?: string
  errorSemantics?: string
  supportedConstraint?: Readonly<{
    summary: string
    evidence: readonly ArtifactEvidenceIdentifier[]
  }>
  recommendedRange?: ReferenceSummary<'recommendation' | 'none'>
  localValidation?: ReferenceSummary<'validation' | 'none'>
}

export interface ConfigurationGroupRecord extends ReferenceRecordBase, ConfigurationSemantics {
  kind: 'configuration-group'
  children: readonly string[]
}

export interface ConfigurationValueRecord extends ReferenceRecordBase, ConfigurationSemantics {
  kind: 'configuration-value'
  valueType: string
  default: ReferenceSummary<'literal' | 'conditional' | 'inherited' | 'omitted'>
  reset: ReferenceSummary<'value' | 'omission' | 'none'>
  minimumExample: ReferenceMinimumExample
  lifecycle: string
  errorSemantics: string
  supportedConstraint: Readonly<{
    summary: string
    evidence: readonly ArtifactEvidenceIdentifier[]
  }>
  recommendedRange: ReferenceSummary<'recommendation' | 'none'>
  localValidation: ReferenceSummary<'validation' | 'none'>
}

export interface AuthoringInputRecord extends ReferenceRecordBase {
  kind: 'authoring-input'
  syntax: string
  transportTarget: string
  sourcePrecedence: readonly string[]
  downstreamOwnership: string
  minimumExample: ReferenceMinimumExample
}

export interface DelegatedExceptionRecord extends ReferenceRecordBase {
  kind: 'delegated-exception'
  constraint: string
  delegatedOwner: string
  transportRestrictions: readonly string[]
  packageFields: Readonly<{ set: readonly string[], read: readonly string[] }>
  unknownKeyPolicy: string
  allowances: Readonly<{
    functionPaths: readonly string[]
    regexpPaths: readonly string[]
    opaqueIdentityPaths: readonly string[]
  }>
  exclusions: readonly string[]
  packageBehavior: string
}

export type ReferenceRecord
  = | ConfigurationGroupRecord
    | ConfigurationValueRecord
    | AuthoringInputRecord
    | DelegatedExceptionRecord

declare const loadedReferenceRecords: unique symbol
export type LoadedReferenceRecords = readonly ReferenceRecord[] & {
  readonly [loadedReferenceRecords]: true
}

export class ReferenceVerificationInfrastructureFailure extends Error {
  category: ReferenceMismatchCategory
}

export class ReferenceRecordValidationFailure extends Error {
  mismatches: ReferenceMismatch[]
}

export const CONFIGURATION_INVENTORY: readonly string[]
export const CONFIGURATION_ACCEPTANCE: Readonly<{
  contentMermaid: readonly string[]
  runtimeConfigPublicContentMermaid: readonly string[]
  rejected: readonly string[]
  deprecatedAcceptedNoOps: readonly string[]
}>
export const REFERENCE_MISMATCH_CATEGORIES: readonly ReferenceMismatchCategory[]

export interface TypeScriptProbeCase {
  id: string
  category: 'closed-configuration' | 'mermaid-component-props' | 'delegated-open-payload'
  expectation: 'accept' | 'reject'
  source: string
}

export const TYPESCRIPT_PROBE_CASES: readonly TypeScriptProbeCase[]
export interface TypeScriptProbeResult {
  id: TypeScriptProbeCase['id']
  category: TypeScriptProbeCase['category']
  expectation: TypeScriptProbeCase['expectation']
  observed: 'accept' | 'reject'
  passed: boolean
  diagnosticCodes: readonly number[]
}

export function runSemanticTypeScriptProbes(
  artifact: VerifiedArtifactIdentity,
  declarations: { entry: string },
  options?: { probes?: readonly TypeScriptProbeCase[] },
): Promise<readonly TypeScriptProbeResult[]>

export const DIRECT_MERMAID_CONFIG_ALLOWANCES: Readonly<{
  functionPaths: readonly string[]
  regexpPaths: readonly string[]
  opaqueIdentityPaths: readonly string[]
}>

export function discoverArtifactEvidence(
  artifact: VerifiedArtifactIdentity,
  options: {
    relativePath: string
    symbolOrProbeId: string
    workspaceRoot?: string
  },
): Promise<ArtifactEvidenceIdentifier>

export function discoverArtifactRuntimeExport(
  artifact: VerifiedArtifactIdentity,
  options: {
    relativePath?: string
    exportName: string
    workspaceRoot?: string
  },
): Promise<Readonly<{ evidence: ArtifactEvidenceIdentifier, value: unknown }>>

export function discoverArtifactRuntimeAuthority(
  artifact: VerifiedArtifactIdentity,
  options: { symbolOrProbeId: string },
): Promise<Readonly<{
  evidence: ArtifactEvidenceIdentifier
  file: string
  relativePath: string
  source: string
}>>

export function discoverRuntimeEvidence(
  artifact: VerifiedArtifactIdentity,
): Promise<Readonly<{
  literalDefaults: readonly ArtifactEvidenceIdentifier[]
  conditionalDefaults: readonly ArtifactEvidenceIdentifier[]
  validatorsAndPrecedence: readonly ArtifactEvidenceIdentifier[]
  openPayloads: readonly ArtifactEvidenceIdentifier[]
  directMermaidConfigAllowances: readonly ArtifactEvidenceIdentifier[]
}>>

export function probeDirectMermaidConfigAllowances(
  artifact: VerifiedArtifactIdentity,
): Promise<typeof DIRECT_MERMAID_CONFIG_ALLOWANCES>

export function discoverPublicDeclarations(
  artifact: VerifiedArtifactIdentity,
): Promise<Readonly<{
  entry: string
  files: readonly string[]
}>>

export function loadReferenceRecords(
  records: readonly unknown[],
  options?: {
    artifactVersion?: string
    artifact?: VerifiedArtifactIdentity
    workspaceRoot?: string
  },
): Promise<LoadedReferenceRecords>

export function checkReferenceParity(
  records: LoadedReferenceRecords,
  observation?: {
    artifactVersion?: string
    paths?: readonly string[]
    fragments?: readonly string[]
    runtimePaths?: readonly string[]
    checks?: Partial<Record<
      | 'types'
      | 'defaults'
      | 'conditionalDefaults'
      | 'precedence'
      | 'delegatedDescendants'
      | 'exceptions'
      | 'deprecations'
      | 'constraintEvidence'
      | 'snippets',
      'match' | 'mismatch'
    >>
  },
): Promise<readonly Readonly<ReferenceMismatch>[]>
