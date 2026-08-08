export class ReleaseVerificationInfrastructureError extends Error {
  constructor(message: string, options?: { cause?: unknown })
}

export class ReleaseVerificationPackageUserError extends Error {
  constructor(message: string, options?: { cause?: unknown })
}

export type RegistrySmokeFailureClassification
  = | 'registry'
    | 'network'
    | 'runner'
    | 'permission'
    | 'package-defect'

export function classifyInfrastructureCause(error: unknown, diagnostic?: unknown): boolean
export function createReleaseVerificationFailure(
  message: string,
  options?: { cause?: unknown, diagnostic?: unknown },
): ReleaseVerificationInfrastructureError | ReleaseVerificationPackageUserError
export function isPackageUserFailure(error: unknown): boolean
export function classifyRegistrySmokeFailure(error: unknown): RegistrySmokeFailureClassification
