const VERSION_KEYS = Object.freeze([
  'betterSqlite3',
  'nuxt',
  'nuxtContent',
  'mermaid',
  'typescript',
  'vueTsc',
])
const NUMERIC_IDENTIFIER_PATTERN = /^(?:0|[1-9]\d*)$/
const IDENTIFIER_PATTERN = /^[0-9A-Z-]+$/i
const RUNTIME_VERSIONS = Object.freeze({
  betterSqlite3: '12.11.1',
  mermaid: '11.12.3',
  typescript: '5.9.3',
  vueTsc: '3.2.5',
})

export const PINNED_MATRIX_PROFILE_IDS = Object.freeze([
  'nuxt-3-minimum',
  'nuxt-4-minimum',
  'nuxt-3-known-latest',
  'nuxt-4-known-latest',
  'nuxt-3-minimum-content-known-latest',
  'nuxt-4-known-latest-content-minimum',
])

function isExactVersion(version) {
  const buildSeparator = version.indexOf('+')
  if (buildSeparator !== version.lastIndexOf('+')) return false

  const versionWithoutBuild = buildSeparator < 0
    ? version
    : version.slice(0, buildSeparator)
  const build = buildSeparator < 0 ? undefined : version.slice(buildSeparator + 1)
  if (build !== undefined
    && !build.split('.').every(identifier => IDENTIFIER_PATTERN.test(identifier))) {
    return false
  }

  const prereleaseSeparator = versionWithoutBuild.indexOf('-')
  const core = prereleaseSeparator < 0
    ? versionWithoutBuild
    : versionWithoutBuild.slice(0, prereleaseSeparator)
  const prerelease = prereleaseSeparator < 0
    ? undefined
    : versionWithoutBuild.slice(prereleaseSeparator + 1)
  if (prerelease !== undefined
    && !prerelease.split('.').every(identifier => (
      IDENTIFIER_PATTERN.test(identifier)
      && (!/^\d+$/.test(identifier) || NUMERIC_IDENTIFIER_PATTERN.test(identifier))
    ))) {
    return false
  }

  const coreIdentifiers = core.split('.')
  return coreIdentifiers.length === 3
    && coreIdentifiers.every(identifier => NUMERIC_IDENTIFIER_PATTERN.test(identifier))
}

export function parseVersionProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Invalid Version Profile: expected an object')
  }
  if (typeof input.id !== 'string' || input.id.length === 0) {
    throw new TypeError('Invalid Version Profile: id must be a non-empty string')
  }
  if (!input.versions || typeof input.versions !== 'object' || Array.isArray(input.versions)) {
    throw new TypeError('Invalid Version Profile: versions must be an object')
  }

  const receivedKeys = Object.keys(input.versions).sort()
  const expectedKeys = [...VERSION_KEYS].sort()
  if (receivedKeys.length !== expectedKeys.length
    || receivedKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new TypeError(`Invalid Version Profile: expected version keys ${VERSION_KEYS.join(', ')}`)
  }

  const versions = {}
  for (const key of VERSION_KEYS) {
    const version = input.versions[key]
    if (typeof version !== 'string' || !isExactVersion(version)) {
      throw new TypeError(`Invalid Version Profile: versions.${key} must be an exact version`)
    }
    versions[key] = version
  }

  return Object.freeze({
    id: input.id,
    versions: Object.freeze(versions),
  })
}

function defineVersionProfile(id, nuxt, nuxtContent) {
  return parseVersionProfile({
    id,
    versions: {
      ...RUNTIME_VERSIONS,
      nuxt,
      nuxtContent,
    },
  })
}

export const VERSION_PROFILES = Object.freeze({
  'nuxt-3-minimum': defineVersionProfile('nuxt-3-minimum', '3.20.1', '3.5.0'),
  'nuxt-4-minimum': defineVersionProfile('nuxt-4-minimum', '4.1.0', '3.5.0'),
  'nuxt-3-known-latest': defineVersionProfile('nuxt-3-known-latest', '3.21.11', '3.15.2'),
  'nuxt-4-known-latest': defineVersionProfile('nuxt-4-known-latest', '4.5.2', '3.15.2'),
  'nuxt-3-minimum-content-known-latest': defineVersionProfile(
    'nuxt-3-minimum-content-known-latest',
    '3.20.1',
    '3.15.2',
  ),
  'nuxt-4-known-latest-content-minimum': defineVersionProfile(
    'nuxt-4-known-latest-content-minimum',
    '4.5.2',
    '3.5.0',
  ),
})

export function selectVersionProfile(profileId) {
  const profile = VERSION_PROFILES[profileId]
  if (!profile) throw new Error(`Unknown Version Profile: ${profileId}`)
  return profile
}

export function expandVersionProfiles({ profileId, matrixId }) {
  if (profileId && matrixId) {
    throw new Error('Choose either one Version Profile or one matrix')
  }
  if (profileId) return Object.freeze([selectVersionProfile(profileId)])
  if (matrixId === 'pinned') {
    return Object.freeze(PINNED_MATRIX_PROFILE_IDS.map(selectVersionProfile))
  }
  throw new Error(`Unknown Version Profile matrix: ${matrixId}`)
}
