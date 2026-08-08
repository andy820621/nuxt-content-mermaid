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
const PERMISSION_ERROR_CODES = new Set(['EACCES', 'EPERM'])
const NETWORK_ERROR_CODES = new Set(
  [...INFRASTRUCTURE_ERROR_CODES].filter(code => code !== 'ENOENT'),
)

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

function isMissingRunnerDiagnostic(error) {
  return isMissingPlaywrightExecutable(error)
    || /(?:browser|executable).*(?:doesn't exist|not found|missing)/i.test(errorMessage(error))
}

function isRegistryCode(code) {
  return /^E[45]\d{2}$/.test(code)
    || /^ERR_PNPM_FETCH_[45]\d{2}$/.test(code)
}

function isRegistryDiagnostic(error, code) {
  const message = errorMessage(error)
  return isRegistryCode(code)
    || (/\b(?:npm\s+)?registry(?:\.npmjs\.org)?\b/i.test(message)
      && /\b(?:HTTP\s*)?[45]\d{2}\b/i.test(message))
}

function errorCode(error) {
  return typeof error?.code === 'string' ? error.code.toUpperCase() : ''
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

export function isPackageUserFailure(error, seen = new Set()) {
  if (!error || typeof error !== 'object' || seen.has(error)) return false
  seen.add(error)
  return error instanceof ReleaseVerificationPackageUserError
    || isPackageUserFailure(error.cause, seen)
}

/**
 * Categorises a registry-smoke failure for follow-up handling. It intentionally
 * treats unknown external failures as runner failures: package defects require
 * the runner's explicit Package User error marker.
 */
export function classifyRegistrySmokeFailure(error) {
  const seen = new Set()
  let current = error

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const code = errorCode(current)

    if (PERMISSION_ERROR_CODES.has(code)) return 'permission'
    if (isRegistryDiagnostic(current, code)) return 'registry'
    if (NETWORK_ERROR_CODES.has(code)) return 'network'
    if (code === 'ENOENT' || isMissingRunnerDiagnostic(current)) return 'runner'
    if (isPackageUserFailure(current)) return 'package-defect'

    current = current.cause
  }

  return 'runner'
}
