import type { LoadedReferenceRecords, VerifiedArtifactIdentity } from './reference-parity.mjs'

export const WEBSITE_REFERENCE_CORPUS_PATH: string

export function loadWebsiteReferenceCorpus(options?: {
  artifact?: VerifiedArtifactIdentity
  artifactVersion?: string
  repositoryRoot?: string
  readText?: (path: string) => Promise<string>
}): Promise<LoadedReferenceRecords>
