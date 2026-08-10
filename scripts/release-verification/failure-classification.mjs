const INFRASTRUCTURE_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENETDOWN',
  'ENETUNREACH',
  'ENFILE',
  'ENOBUFS',
  'ENOENT',
  'ENOTFOUND',
  'ETIMEDOUT',
])
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function hasInfrastructureCause(error, seen = new Set()) {
  if (!error || typeof error !== 'object' || seen.has(error)) return false
  seen.add(error)
  if (error instanceof ReleaseVerificationInfrastructureError) return true
  const code = typeof error.code === 'string' ? error.code.toUpperCase() : ''
  return INFRASTRUCTURE_ERROR_CODES.has(code)
    || hasInfrastructureCause(error.cause, seen)
}

function isMissingPlaywrightExecutable(error) {
  return /browserType\.launch:.*Executable doesn't exist/i.test(errorMessage(error))
}

function hasInfrastructureDiagnostic(diagnostic) {
  const text = String(diagnostic ?? '')
  return [...INFRASTRUCTURE_ERROR_CODES].some(code => (
    new RegExp(`\\b${code}\\b`, 'i').test(text)
  ))
}

export class ReleaseVerificationInfrastructureError extends Error {
  constructor(message, { cause } = {}) {
    super(message, { cause })
    this.name = 'ReleaseVerificationInfrastructureError'
  }
}

export class ReleaseVerificationPackageUserError extends Error {
  constructor(message, { cause } = {}) {
    super(message, { cause })
    this.name = 'ReleaseVerificationPackageUserError'
  }
}

export function classifyInfrastructureCause(error, diagnostic) {
  return hasInfrastructureCause(error)
    || isMissingPlaywrightExecutable(error)
    || hasInfrastructureDiagnostic(diagnostic)
}

export function createReleaseVerificationFailure(message, { cause, diagnostic = message } = {}) {
  const Failure = classifyInfrastructureCause(cause, diagnostic)
    ? ReleaseVerificationInfrastructureError
    : ReleaseVerificationPackageUserError
  return new Failure(message, { cause })
}
