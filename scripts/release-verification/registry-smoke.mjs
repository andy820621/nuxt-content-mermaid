import { classifyRegistrySmokeFailure } from './failure-classification.mjs'
import { RegistrySmokeVerificationFailure } from './runner.mjs'
import { parseVersionProfile } from './profiles.mjs'

const EXACT_SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9a-z-]+(?:\.[0-9a-z-]+)*))?(?:\+([0-9a-z-]+(?:\.[0-9a-z-]+)*))?$/i

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`Registry smoke ${label} must be a non-empty string`)
  }
  return value
}

function parseExactPackageVersion(packageVersion) {
  const match = typeof packageVersion === 'string'
    ? EXACT_SEMVER_PATTERN.exec(packageVersion)
    : null
  const prerelease = match?.[4]?.split('.') ?? []
  if (!match || prerelease.some(identifier => /^\d+$/.test(identifier) && /^0\d+/.test(identifier))) {
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
  return Object.freeze({
    status: 'pending',
    package: Object.freeze({
      name: requireNonEmptyString(packageName, 'package name'),
      version: parseExactPackageVersion(packageVersion),
    }),
    profile: Object.freeze({
      id: exactProfile.id,
      requested: freezeRequestedProfile(requestedProfile),
      resolved: exactProfile.versions,
    }),
    attempts: Object.freeze([]),
    retryCommand: null,
  })
}

function assertPendingRegistryHealth(registryHealth) {
  if (!registryHealth || typeof registryHealth !== 'object'
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
    versions: registryHealth.profile.resolved,
  })
  const request = Object.freeze({
    packageName: registryHealth.package.name,
    packageVersion: registryHealth.package.version,
    profile,
  })

  try {
    const verification = await verifyRegistryPackage(request)
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
