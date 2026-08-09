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
  mermaid: '11.16.1',
  typescript: '5.9.3',
  vueTsc: '3.2.5',
})
const FINAL_TOOLCHAIN_RESOLUTIONS = Object.freeze({
  nuxtKit: '4.5.2',
  nuxtSchema: '4.5.2',
})

function parseExpectedResolutions(input) {
  if (input === undefined) return undefined
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Invalid Version Profile: expectedResolutions must be an object')
  }

  const receivedKeys = Object.keys(input).sort()
  const expectedKeys = ['nuxtKit', 'nuxtSchema']
  if (receivedKeys.length !== expectedKeys.length
    || receivedKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new TypeError('Invalid Version Profile: expected resolution keys nuxtKit, nuxtSchema')
  }

  for (const key of expectedKeys) {
    if (!parseExactSemver(input[key])) {
      throw new TypeError(
        `Invalid Version Profile: expectedResolutions.${key} must be an exact version`,
      )
    }
  }

  return Object.freeze({
    nuxtKit: input.nuxtKit,
    nuxtSchema: input.nuxtSchema,
  })
}

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

  const expectedResolutions = parseExpectedResolutions(input.expectedResolutions)
  return Object.freeze({
    id: input.id,
    nodeVersion: input.nodeVersion,
    versions: Object.freeze(versions),
    ...(expectedResolutions ? { expectedResolutions } : {}),
  })
}

function defineFinalVersionProfile(id, nodeVersion, nuxt, nuxtContent) {
  return parseVersionProfile({
    id,
    nodeVersion,
    versions: {
      ...RUNTIME_VERSIONS,
      nuxt,
      nuxtContent,
    },
    expectedResolutions: FINAL_TOOLCHAIN_RESOLUTIONS,
  })
}

export const VERSION_PROFILES = Object.freeze({
  'v3-minimum': defineFinalVersionProfile('v3-minimum', '22.19.0', '4.1.0', '3.5.0'),
  'v3-known-latest': defineFinalVersionProfile(
    'v3-known-latest',
    '24.19.0',
    '4.5.2',
    '3.15.2',
  ),
})

export function selectVersionProfile(profileId) {
  const profile = VERSION_PROFILES[profileId]
  if (!profile) throw new Error(`Unknown Version Profile: ${profileId}`)
  return profile
}
