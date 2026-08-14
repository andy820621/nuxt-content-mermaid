import type {
  LoadedReferenceRecords,
  ReferenceMismatch,
  VerifiedArtifactIdentity,
} from './reference-parity.mjs'

export const DELEGATED_EXCEPTION_PATHS: readonly string[]

export interface ReferenceVerificationResult {
  artifact?: VerifiedArtifactIdentity
  recordCount: number
  mismatches: readonly Readonly<ReferenceMismatch>[]
}

export interface ReferenceSnippetResult {
  typescript: boolean
  markdown: boolean
}

export function verifyReferenceSnippets(options: {
  records: LoadedReferenceRecords
  repositoryRoot: string
  operations?: unknown
}): Promise<Readonly<ReferenceSnippetResult>>

export function verifyWebsiteReference(options?: {
  repositoryRoot?: string
  resolveArtifact?: (options: { repositoryRoot?: string }) => Promise<VerifiedArtifactIdentity>
  loadCorpus?: (options: {
    artifact: VerifiedArtifactIdentity
    repositoryRoot?: string
  }) => Promise<LoadedReferenceRecords>
  verifySnippets?: (options: {
    artifact: VerifiedArtifactIdentity
    records: LoadedReferenceRecords
    repositoryRoot?: string
  }) => Promise<ReferenceSnippetResult>
}): Promise<Readonly<ReferenceVerificationResult>>

export function runWebsiteReferenceCli(options?: {
  repositoryRoot?: string
  verifyReference?: (options: { repositoryRoot: string }) => Promise<ReferenceVerificationResult>
  writeOutput?: (value: string) => void
}): Promise<ReferenceVerificationResult>
