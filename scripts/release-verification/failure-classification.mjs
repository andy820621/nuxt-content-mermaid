import { parseExactSemver } from './exact-semver.mjs'

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
const REGISTRY_SMOKE_ROOT_PACKAGE = '@barzhsieh/nuxt-content-mermaid'

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function diagnosticText(error) {
  const diagnostics = [errorMessage(error)]
  if (error && typeof error === 'object') {
    if (error.stdout) diagnostics.push(String(error.stdout))
    if (error.stderr) diagnostics.push(String(error.stderr))
  }
  return diagnostics.join('\n')
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

function npmDiagnosticCode(error) {
  return /\bnpm\s+(?:ERR!|error)\s+code\s+([A-Z]\w*)\b/i
    .exec(diagnosticText(error))?.[1]?.toUpperCase() ?? ''
}

function isRootExactVersionTargetDiagnostic(error, code) {
  if (code !== 'ETARGET') return false
  const packageSpec = /\bNo matching version found for\s+(\S+)/i
    .exec(diagnosticText(error))
    ?.[1]?.replace(/\.$/, '')
  const versionSeparator = packageSpec?.lastIndexOf('@') ?? -1
  if (versionSeparator <= 0
    || packageSpec.slice(0, versionSeparator) !== REGISTRY_SMOKE_ROOT_PACKAGE) return false
  return Boolean(parseExactSemver(packageSpec.slice(versionSeparator + 1)))
}

function isRegistryDiagnostic(error, code) {
  const diagnostic = diagnosticText(error)
  return isRegistryCode(code)
    || isRootExactVersionTargetDiagnostic(error, code)
    || (/\b(?:npm\s+)?registry(?:\.npmjs\.org)?\b/i.test(diagnostic)
      && /\b(?:HTTP\s*)?[45]\d{2}\b/i.test(diagnostic))
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
  let packageUserFailure = false

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const code = errorCode(current) || npmDiagnosticCode(current)
    packageUserFailure ||= isPackageUserFailure(current)

    if (PERMISSION_ERROR_CODES.has(code)) return 'permission'
    if (isRegistryDiagnostic(current, code)) return 'registry'
    if (NETWORK_ERROR_CODES.has(code)) return 'network'
    if (code === 'ENOENT' || isMissingRunnerDiagnostic(current)) return 'runner'

    current = current.cause
  }

  return packageUserFailure ? 'package-defect' : 'runner'
}
