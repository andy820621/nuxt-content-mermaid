import type {
  LoadedReferenceRecords,
  ReferenceMinimumExample,
  ReferenceOccurrence,
  ReferenceSummary,
  VerifiedArtifactIdentity,
} from './reference-parity.mjs'

interface PublicReferenceBase {
  kind: 'configuration-group' | 'configuration-value' | 'authoring-input' | 'delegated-exception'
  path: string
  fragment: string
  title: string
  description: string
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

interface PublicConfigurationSemantics {
  precedence: readonly string[]
  default?: ReferenceSummary<'literal' | 'conditional' | 'inherited' | 'omitted'>
  reset?: ReferenceSummary<'value' | 'omission' | 'none'>
  minimumExample?: Omit<ReferenceMinimumExample, 'id'>
  lifecycle?: string
  errorSemantics?: string
  supportedConstraint?: Readonly<{ summary: string }>
  recommendedRange?: ReferenceSummary<'recommendation' | 'none'>
  localValidation?: ReferenceSummary<'validation' | 'none'>
}

interface PublicGroupSemantics {
  precedence: readonly string[]
  default?: ReferenceSummary<'literal' | 'conditional' | 'inherited' | 'omitted'>
  reset?: ReferenceSummary<'value' | 'omission' | 'none'>
  minimumExample?: Omit<ReferenceMinimumExample, 'id'>
  lifecycle?: string
  errorSemantics?: undefined
  supportedConstraint?: undefined
  recommendedRange?: undefined
  localValidation?: undefined
}

export interface PublicConfigurationGroup extends PublicReferenceBase, PublicGroupSemantics {
  kind: 'configuration-group'
  children: readonly string[]
}

export interface PublicConfigurationValue extends PublicReferenceBase, PublicConfigurationSemantics {
  kind: 'configuration-value'
  valueType: string
}

export interface PublicAuthoringInput extends PublicReferenceBase {
  kind: 'authoring-input'
  syntax: string
  transportTarget: string
  sourcePrecedence: readonly string[]
  downstreamOwnership: string
  minimumExample: Omit<ReferenceMinimumExample, 'id'>
}

export interface PublicDelegatedException extends PublicReferenceBase {
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

export type PublicReferenceRecord
  = | PublicConfigurationGroup
    | PublicConfigurationValue
    | PublicAuthoringInput
    | PublicDelegatedException

export interface WebsiteReferencePublicModel {
  identity: '@barzhsieh/nuxt-content-mermaid@3.0.0'
  recordCount: 43
  sections: Readonly<{
    configurationGroups: readonly PublicConfigurationGroup[]
    configurationValues: readonly PublicConfigurationValue[]
    authoringInputs: readonly PublicAuthoringInput[]
    delegatedPayloads: readonly PublicDelegatedException[]
    deprecatedOptions: readonly PublicConfigurationValue[]
  }>
}

export function projectWebsiteReferencePublicModel(records: LoadedReferenceRecords): WebsiteReferencePublicModel
export function loadWebsiteReferencePublicModel(options?: {
  artifact?: VerifiedArtifactIdentity
  repositoryRoot?: string
}): Promise<WebsiteReferencePublicModel>
