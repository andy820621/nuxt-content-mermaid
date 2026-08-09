import { parseExactSemver } from './exact-semver.mjs'
import { classifyRegistrySmokeFailure } from './failure-classification.mjs'
import { RegistrySmokeVerificationFailure } from './runner.mjs'
import { parseVersionProfile } from './profiles.mjs'
import { isDeepStrictEqual } from 'node:util'

const PENDING_REGISTRY_HEALTH = new WeakSet()

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`Registry smoke ${label} must be a non-empty string`)
  }
  return value
}

function parseExactPackageVersion(packageVersion) {
  if (!parseExactSemver(packageVersion)) {
    throw new TypeError('Registry smoke requires an exact package version')
  }
  return packageVersion
}

function freezeRequestedProfile(requestedProfile) {
  if (!requestedProfile || typeof requestedProfile !== 'object' || Array.isArray(requestedProfile)) {
    throw new TypeError('Registry smoke requested profile must be an object')
  }
  const keys = Object.keys(requestedProfile).sort()
  if (keys.length !== 2 || keys[0] !== 'nuxt' || keys[1] !== 'nuxtContent') {
    throw new TypeError('Registry smoke requested profile requires nuxt and nuxtContent ranges')
  }
  return Object.freeze({
    nuxt: requireNonEmptyString(requestedProfile.nuxt, 'requested Nuxt range'),
    nuxtContent: requireNonEmptyString(requestedProfile.nuxtContent, 'requested Nuxt Content range'),
  })
}

function freezeRegistryHealth({ packageName, packageVersion, requestedProfile, profile }) {
  const exactProfile = parseVersionProfile(profile)
  const registryHealth = Object.freeze({
    status: 'pending',
    package: Object.freeze({
      name: requireNonEmptyString(packageName, 'package name'),
      version: parseExactPackageVersion(packageVersion),
    }),
    profile: Object.freeze({
      id: exactProfile.id,
      nodeVersion: exactProfile.nodeVersion,
      requested: freezeRequestedProfile(requestedProfile),
      resolved: exactProfile.versions,
    }),
    attempts: Object.freeze([]),
    retryCommand: null,
  })
  PENDING_REGISTRY_HEALTH.add(registryHealth)
  return registryHealth
}

function assertPendingRegistryHealth(registryHealth) {
  if (!registryHealth || typeof registryHealth !== 'object'
    || !PENDING_REGISTRY_HEALTH.has(registryHealth)
    || registryHealth.status !== 'pending'
    || !Array.isArray(registryHealth.attempts)
    || registryHealth.attempts.length !== 0
    || registryHealth.retryCommand !== null) {
    throw new TypeError('Initial registry smoke requires pending registry health evidence')
  }
}

function freezeAttempt(attempt) {
  return Object.freeze(attempt)
}

function completeRegistryHealth(registryHealth, attempt, { status, retryCommand }) {
  return Object.freeze({
    status,
    package: registryHealth.package,
    profile: registryHealth.profile,
    attempts: Object.freeze([freezeAttempt(attempt)]),
    retryCommand,
  })
}

function hasRegistrySmokeVerificationEvidence(error) {
  return error.evidence
    && typeof error.evidence === 'object'
    && error.evidence.mode === 'registry-smoke'
}

function invalidSuccessfulVerification(message) {
  throw new TypeError(`Registry smoke verifier returned invalid successful evidence: ${message}`)
}

function parseReportedProfile(profile, nodeVersion, versions, label) {
  try {
    return parseVersionProfile({
      id: profile?.id,
      nodeVersion,
      versions,
    })
  }
  catch {
    invalidSuccessfulVerification(`${label} profile is malformed`)
  }
}

function validateSuccessfulRegistryVerification(verification, request) {
  if (!verification || typeof verification !== 'object') {
    invalidSuccessfulVerification('expected an object')
  }
  if (verification.mode !== 'registry-smoke') {
    invalidSuccessfulVerification('mode must be registry-smoke')
  }
  if (verification.success !== true) {
    invalidSuccessfulVerification('success must be true')
  }
  if (verification.package?.name !== request.packageName
    || verification.package?.requestedVersion !== request.packageVersion
    || verification.package?.resolvedVersion !== request.packageVersion) {
    invalidSuccessfulVerification('package identity must match the request')
  }

  const requestedProfile = parseReportedProfile(
    verification.profile,
    verification.runtime?.requested,
    verification.profile?.requested,
    'requested',
  )
  const resolvedProfile = parseReportedProfile(
    verification.profile,
    verification.runtime?.observed,
    verification.profile?.resolved,
    'resolved',
  )
  if (!isDeepStrictEqual(request.profile, requestedProfile)
    || !isDeepStrictEqual(request.profile, resolvedProfile)) {
    invalidSuccessfulVerification('requested and resolved profiles must match the request')
  }

  return verification
}

function invalidRetryEvidence(message) {
  throw new TypeError(`Registry smoke retry evidence ${message}`)
}

function assertRetryCallbacks({ readEvidence, writeEvidence, verifyRegistryPackage, now }) {
  if (typeof readEvidence !== 'function') {
    throw new TypeError('Registry smoke retry requires a readEvidence callback')
  }
  if (typeof writeEvidence !== 'function') {
    throw new TypeError('Registry smoke retry requires a writeEvidence callback')
  }
  if (typeof verifyRegistryPackage !== 'function') {
    throw new TypeError('Registry smoke retry requires a verifyRegistryPackage callback')
  }
  if (typeof now !== 'function') {
    throw new TypeError('Registry smoke retry requires a now callback')
  }
}

function loadRetryRequest(evidence, targetVersion) {
  if (!evidence || typeof evidence !== 'object') {
    invalidRetryEvidence('must be an object')
  }
  if (evidence.status !== 'published') {
    invalidRetryEvidence('must record a published release')
  }
  if (evidence.identity?.targetVersion !== targetVersion) {
    invalidRetryEvidence('identity must match the target version')
  }
  if (evidence.artifact?.packageVersion !== targetVersion) {
    invalidRetryEvidence('artifact must match the target version')
  }

  const registryHealth = evidence.registryHealth
  if (!registryHealth || typeof registryHealth !== 'object') {
    invalidRetryEvidence('requires registry health')
  }
  if (registryHealth.status !== 'investigation') {
    invalidRetryEvidence('requires an investigation')
  }
  if (registryHealth.package?.version !== targetVersion) {
    invalidRetryEvidence('package must match the target version')
  }
  if (!Array.isArray(registryHealth.attempts) || registryHealth.attempts.length < 1) {
    invalidRetryEvidence('requires a first attempt')
  }

  const firstAttempt = registryHealth.attempts[0]
  if (firstAttempt?.number !== 1) {
    invalidRetryEvidence('requires first attempt number 1')
  }
  if (firstAttempt.cleanConsumer !== true) {
    invalidRetryEvidence('requires an independent clean first attempt')
  }

  freezeRequestedProfile(registryHealth.profile?.requested)
  const resolvedProfile = parseVersionProfile({
    id: registryHealth.profile?.id,
    nodeVersion: registryHealth.profile?.nodeVersion,
    versions: registryHealth.profile?.resolved,
  })
  const packageName = requireNonEmptyString(registryHealth.package.name, 'package name')
  const packageVersion = parseExactPackageVersion(registryHealth.package.version)
  if (firstAttempt.verification?.mode !== 'registry-smoke'
    || firstAttempt.verification?.package?.name !== packageName
    || firstAttempt.verification?.package?.requestedVersion !== targetVersion) {
    invalidRetryEvidence('first attempt must request the exact package identity')
  }
  const firstAttemptRequestedProfile = parseVersionProfile({
    id: firstAttempt.verification.profile?.id,
    nodeVersion: firstAttempt.verification.runtime?.requested,
    versions: firstAttempt.verification.profile?.requested,
  })
  if (!isDeepStrictEqual(resolvedProfile, firstAttemptRequestedProfile)) {
    invalidRetryEvidence('frozen profile must match the first attempt request')
  }

  const installFailedBeforeResolution = firstAttempt.success === false
    && firstAttempt.verification.success === false
    && firstAttempt.stage === 'install'
    && firstAttempt.verification.package.resolvedVersion === null
    && firstAttempt.verification.profile?.resolved === null
  if (!installFailedBeforeResolution) {
    if (firstAttempt.verification.package.resolvedVersion !== targetVersion) {
      invalidRetryEvidence('first attempt must resolve the exact package version')
    }
    const firstAttemptProfile = parseVersionProfile({
      id: firstAttempt.verification.profile?.id,
      nodeVersion: firstAttempt.verification.runtime?.observed,
      versions: firstAttempt.verification.profile?.resolved,
    })
    if (!isDeepStrictEqual(resolvedProfile, firstAttemptProfile)) {
      invalidRetryEvidence('frozen profile must match the first attempt')
    }
  }

  return Object.freeze({
    packageName,
    packageVersion,
    profile: resolvedProfile,
    registryHealth,
  })
}

function cleanConsumerFromVerification(verification) {
  return verification?.cleanConsumer !== false
}

function matchesFrozenRetryRequest(verification, { packageVersion, profile }) {
  if (verification?.mode !== 'registry-smoke'
    || verification.package?.requestedVersion !== packageVersion
    || verification.package?.resolvedVersion !== packageVersion) {
    return false
  }
  try {
    const reportedProfile = parseVersionProfile({
      id: verification.profile?.id,
      nodeVersion: verification.runtime?.observed,
      versions: verification.profile?.resolved,
    })
    return isDeepStrictEqual(profile, reportedProfile)
  }
  catch {
    return false
  }
}

function createsConfirmedPackageDefect(firstAttempt, retryAttempt, frozenRequest) {
  const isPackageUserStage = stage => stage === 'install' || stage === 'build' || stage === 'runtime'
  return firstAttempt.cleanConsumer === true
    && retryAttempt.cleanConsumer === true
    && firstAttempt.classification === 'package-defect'
    && retryAttempt.classification === 'package-defect'
    && isPackageUserStage(firstAttempt.stage)
    && firstAttempt.stage === retryAttempt.stage
    && matchesFrozenRetryRequest(retryAttempt.verification, frozenRequest)
}

export function createPendingRegistryHealth(input) {
  return freezeRegistryHealth(input ?? {})
}

export async function runInitialRegistrySmoke({ registryHealth, verifyRegistryPackage, now }) {
  assertPendingRegistryHealth(registryHealth)
  if (typeof verifyRegistryPackage !== 'function') {
    throw new TypeError('Initial registry smoke requires a verifyRegistryPackage callback')
  }
  if (typeof now !== 'function') {
    throw new TypeError('Initial registry smoke requires a now callback')
  }

  const profile = Object.freeze({
    id: registryHealth.profile.id,
    nodeVersion: registryHealth.profile.nodeVersion,
    versions: registryHealth.profile.resolved,
  })
  const request = Object.freeze({
    packageName: registryHealth.package.name,
    packageVersion: registryHealth.package.version,
    profile,
  })

  try {
    const verification = validateSuccessfulRegistryVerification(
      await verifyRegistryPackage(request),
      request,
    )
    return completeRegistryHealth(registryHealth, {
      number: 1,
      completedAt: now(),
      cleanConsumer: true,
      success: true,
      stage: null,
      classification: null,
      verification,
    }, {
      status: 'healthy',
      retryCommand: null,
    })
  }
  catch (error) {
    if (!(error instanceof RegistrySmokeVerificationFailure)
      || !hasRegistrySmokeVerificationEvidence(error)) {
      throw error
    }
    return completeRegistryHealth(registryHealth, {
      number: 1,
      completedAt: now(),
      cleanConsumer: true,
      success: false,
      stage: error.stage,
      classification: classifyRegistrySmokeFailure(error.cause),
      verification: error.evidence,
    }, {
      status: 'investigation',
      retryCommand: `pnpm release registry-smoke ${registryHealth.package.version}`,
    })
  }
}

export async function runRegistrySmokeRetry({
  repositoryRoot,
  targetVersion,
  readEvidence,
  writeEvidence,
  verifyRegistryPackage,
  now,
}) {
  assertRetryCallbacks({ readEvidence, writeEvidence, verifyRegistryPackage, now })
  const evidence = await readEvidence({ repositoryRoot, targetVersion })
  const { registryHealth, packageName, packageVersion, profile } = loadRetryRequest(
    evidence,
    targetVersion,
  )
  const request = Object.freeze({
    packageName,
    packageVersion,
    profile,
  })

  try {
    const verification = validateSuccessfulRegistryVerification(
      await verifyRegistryPackage(request),
      request,
    )
    const cleanConsumer = cleanConsumerFromVerification(verification)
    const attempt = {
      number: registryHealth.attempts.length + 1,
      completedAt: now(),
      cleanConsumer,
      success: true,
      stage: null,
      classification: null,
      verification,
    }
    evidence.registryHealth = {
      ...registryHealth,
      status: cleanConsumer ? 'healthy' : 'investigation',
      attempts: [...registryHealth.attempts, attempt],
      retryCommand: cleanConsumer ? null : registryHealth.retryCommand,
    }
  }
  catch (error) {
    if (!(error instanceof RegistrySmokeVerificationFailure)
      || !hasRegistrySmokeVerificationEvidence(error)) {
      throw error
    }
    const attempt = {
      number: registryHealth.attempts.length + 1,
      completedAt: now(),
      cleanConsumer: cleanConsumerFromVerification(error.evidence),
      success: false,
      stage: error.stage,
      classification: classifyRegistrySmokeFailure(error.cause),
      verification: error.evidence,
    }
    evidence.registryHealth = {
      ...registryHealth,
      status: createsConfirmedPackageDefect(registryHealth.attempts[0], attempt, request)
        ? 'unhealthy'
        : 'investigation',
      attempts: [...registryHealth.attempts, attempt],
      retryCommand: registryHealth.retryCommand,
    }
  }

  await writeEvidence(evidence)
  return evidence
}
