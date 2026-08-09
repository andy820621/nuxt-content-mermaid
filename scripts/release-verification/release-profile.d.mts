import type {
  PackageArtifactEvidence,
  PackageArtifactVerificationRequest,
  ReleaseVerificationOperations,
  runPackageArtifactVerification,
} from './runner.mjs'

export function runReleaseProfileChild(input: {
  requestPath: string
  resultPath: string
  verifier?: typeof runPackageArtifactVerification
  operations?: ReleaseVerificationOperations
}): Promise<PackageArtifactEvidence>

export function parseReleaseProfileArguments(argv: string[]): {
  requestPath: string
  resultPath: string
}

export function runReleaseProfileCli(input?: {
  argv?: string[]
}): Promise<PackageArtifactEvidence>

export interface ReleaseProfileChildRequest {
  schemaVersion: 1
  artifact: Extract<
    PackageArtifactVerificationRequest['packageSource'],
    { kind: 'retained' }
  >['artifact']
  profile: PackageArtifactVerificationRequest['profile']
}
