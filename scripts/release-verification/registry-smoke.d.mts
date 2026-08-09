import type { RegistrySmokeFailureClassification } from './failure-classification.mjs'
import type {
  RegistrySmokeVerificationEvidence,
  RegistrySmokeVerificationRequest,
  VerificationStageName,
  VersionProfile,
} from './runner.mjs'

export interface RegistrySmokeAttempt {
  number: number
  completedAt: string
  cleanConsumer: boolean
  success: boolean
  stage: VerificationStageName | null
  classification: RegistrySmokeFailureClassification | null
  verification: RegistrySmokeVerificationEvidence
}

export interface RegistryHealthEvidence {
  status: 'pending' | 'healthy' | 'investigation' | 'unhealthy'
  package: { name: string, version: string }
  profile: {
    id: string
    requested: Record<string, string>
    resolved: VersionProfile['versions']
  }
  attempts: RegistrySmokeAttempt[]
  retryCommand: string | null
}

export function createPendingRegistryHealth(input: {
  packageName: string
  packageVersion: string
  requestedProfile: Record<string, string>
  profile: VersionProfile
}): RegistryHealthEvidence

export function runInitialRegistrySmoke(input: {
  registryHealth: RegistryHealthEvidence
  verifyRegistryPackage: (
    request: RegistrySmokeVerificationRequest,
  ) => Promise<RegistrySmokeVerificationEvidence>
  now: () => string
}): Promise<RegistryHealthEvidence>

export interface RegistrySmokeReleaseEvidence {
  status: 'published'
  identity: { targetVersion: string }
  artifact: { packageVersion: string }
  registryHealth: RegistryHealthEvidence
}

export interface RegistrySmokeRetryVerificationEvidence extends RegistrySmokeVerificationEvidence {
  cleanConsumer?: boolean
}

export function runRegistrySmokeRetry(input: {
  repositoryRoot: string
  targetVersion: string
  readEvidence: (input: {
    repositoryRoot: string
    targetVersion: string
  }) => Promise<RegistrySmokeReleaseEvidence>
  writeEvidence: (evidence: RegistrySmokeReleaseEvidence) => Promise<void>
  verifyRegistryPackage: (
    request: RegistrySmokeVerificationRequest,
  ) => Promise<RegistrySmokeRetryVerificationEvidence>
  now: () => string
}): Promise<RegistrySmokeReleaseEvidence>
