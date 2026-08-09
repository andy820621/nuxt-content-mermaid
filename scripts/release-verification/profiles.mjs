import { parseExactSemver } from './exact-semver.mjs'

const VERSION_KEYS = Object.freeze([
  'betterSqlite3',
  'nuxt',
  'nuxtContent',
  'mermaid',
  'typescript',
  'vueTsc',
])
const RUNTIME_VERSIONS = Object.freeze({
  betterSqlite3: '12.11.1',
  mermaid: '11.12.3',
  typescript: '5.9.3',
  vueTsc: '3.2.5',
})
const NODE_VERSION = '22.21.1'

export const PINNED_MATRIX_PROFILE_IDS = Object.freeze([
  'nuxt-3-minimum',
  'nuxt-4-minimum',
  'nuxt-3-known-latest',
  'nuxt-4-known-latest',
  'nuxt-3-minimum-content-known-latest',
  'nuxt-4-known-latest-content-minimum',
])

export function parseVersionProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Invalid Version Profile: expected an object')
  }
  if (typeof input.id !== 'string' || input.id.length === 0) {
    throw new TypeError('Invalid Version Profile: id must be a non-empty string')
  }
  if (!parseExactSemver(input.nodeVersion)) {
    throw new TypeError('Invalid Version Profile: nodeVersion must be an exact version')
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
    if (!parseExactSemver(version)) {
      throw new TypeError(`Invalid Version Profile: versions.${key} must be an exact version`)
    }
    versions[key] = version
  }

  return Object.freeze({
    id: input.id,
    nodeVersion: input.nodeVersion,
    versions: Object.freeze(versions),
  })
}

function defineVersionProfile(id, nuxt, nuxtContent) {
  return parseVersionProfile({
    id,
    nodeVersion: NODE_VERSION,
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
