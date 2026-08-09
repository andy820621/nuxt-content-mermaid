import { describe, expect, it } from 'vitest'
import {
  PINNED_MATRIX_PROFILE_IDS,
  VERSION_PROFILES,
  expandVersionProfiles,
  parseVersionProfile,
  selectVersionProfile,
} from '../scripts/release-verification/profiles.mjs'

const runtimeVersions = {
  betterSqlite3: '12.11.1',
  mermaid: '11.12.3',
  typescript: '5.9.3',
  vueTsc: '3.2.5',
}

describe('release verification Version Profiles', () => {
  it('declares one exact Node runtime for every profile', () => {
    expect(Object.values(VERSION_PROFILES).map(profile => profile.nodeVersion))
      .toEqual(Array.from({ length: PINNED_MATRIX_PROFILE_IDS.length }, () => '22.21.1'))

    expect(() => parseVersionProfile({
      id: 'missing-node-runtime',
      versions: {
        ...runtimeVersions,
        nuxt: '4.5.2',
        nuxtContent: '3.15.2',
      },
    })).toThrow('nodeVersion must be an exact version')

    expect(() => parseVersionProfile({
      id: 'floating-node-runtime',
      nodeVersion: '22.x',
      versions: {
        ...runtimeVersions,
        nuxt: '4.5.2',
        nuxtContent: '3.15.2',
      },
    })).toThrow('nodeVersion must be an exact version')
  })

  it('defines the complete pinned Representative Compatibility Matrix', () => {
    expect(PINNED_MATRIX_PROFILE_IDS).toEqual([
      'nuxt-3-minimum',
      'nuxt-4-minimum',
      'nuxt-3-known-latest',
      'nuxt-4-known-latest',
      'nuxt-3-minimum-content-known-latest',
      'nuxt-4-known-latest-content-minimum',
    ])
    expect(VERSION_PROFILES).toEqual({
      'nuxt-3-minimum': {
        id: 'nuxt-3-minimum',
        nodeVersion: '22.21.1',
        versions: {
          ...runtimeVersions,
          nuxt: '3.20.1',
          nuxtContent: '3.5.0',
        },
      },
      'nuxt-4-minimum': {
        id: 'nuxt-4-minimum',
        nodeVersion: '22.21.1',
        versions: {
          ...runtimeVersions,
          nuxt: '4.1.0',
          nuxtContent: '3.5.0',
        },
      },
      'nuxt-3-known-latest': {
        id: 'nuxt-3-known-latest',
        nodeVersion: '22.21.1',
        versions: {
          ...runtimeVersions,
          nuxt: '3.21.11',
          nuxtContent: '3.15.2',
        },
      },
      'nuxt-4-known-latest': {
        id: 'nuxt-4-known-latest',
        nodeVersion: '22.21.1',
        versions: {
          ...runtimeVersions,
          nuxt: '4.5.2',
          nuxtContent: '3.15.2',
        },
      },
      'nuxt-3-minimum-content-known-latest': {
        id: 'nuxt-3-minimum-content-known-latest',
        nodeVersion: '22.21.1',
        versions: {
          ...runtimeVersions,
          nuxt: '3.20.1',
          nuxtContent: '3.15.2',
        },
      },
      'nuxt-4-known-latest-content-minimum': {
        id: 'nuxt-4-known-latest-content-minimum',
        nodeVersion: '22.21.1',
        versions: {
          ...runtimeVersions,
          nuxt: '4.5.2',
          nuxtContent: '3.5.0',
        },
      },
    })
  })

  it('expands either one profile or the complete pinned matrix', () => {
    expect(expandVersionProfiles({ profileId: 'nuxt-3-minimum' }))
      .toEqual([VERSION_PROFILES['nuxt-3-minimum']])
    expect(expandVersionProfiles({ matrixId: 'pinned' }).map(profile => profile.id))
      .toEqual(PINNED_MATRIX_PROFILE_IDS)
  })

  it('rejects unknown or ambiguous profile selection', () => {
    expect(() => selectVersionProfile('missing')).toThrow('Unknown Version Profile: missing')
    expect(() => expandVersionProfiles({ matrixId: 'latest' })).toThrow('Unknown Version Profile matrix: latest')
    expect(() => expandVersionProfiles({
      matrixId: 'pinned',
      profileId: 'nuxt-3-minimum',
    })).toThrow('Choose either one Version Profile or one matrix')
  })

  it.each([
    ['missing dependency', {
      id: 'invalid',
      nodeVersion: '22.21.1',
      versions: {
        ...runtimeVersions,
        nuxt: '4.5.2',
      },
    }],
    ['floating dependency', {
      id: 'invalid',
      nodeVersion: '22.21.1',
      versions: {
        ...runtimeVersions,
        nuxt: 'latest',
        nuxtContent: '3.15.2',
      },
    }],
    ['dependency range', {
      id: 'invalid',
      nodeVersion: '22.21.1',
      versions: {
        ...runtimeVersions,
        nuxt: '^4.5.2',
        nuxtContent: '3.15.2',
      },
    }],
    ['trailing prerelease separator', {
      id: 'invalid',
      nodeVersion: '22.21.1',
      versions: {
        ...runtimeVersions,
        nuxt: '4.5.2-preview.',
        nuxtContent: '3.15.2',
      },
    }],
    ['empty prerelease identifier', {
      id: 'invalid',
      nodeVersion: '22.21.1',
      versions: {
        ...runtimeVersions,
        nuxt: '4.5.2-preview..1',
        nuxtContent: '3.15.2',
      },
    }],
    ['leading zero', {
      id: 'invalid',
      nodeVersion: '22.21.1',
      versions: {
        ...runtimeVersions,
        nuxt: '04.5.2',
        nuxtContent: '3.15.2',
      },
    }],
  ])('rejects an invalid profile with a %s', (_label, profile) => {
    expect(() => parseVersionProfile(profile)).toThrow('Invalid Version Profile')
  })

  it('accepts exact SemVer build metadata without treating it as a range', () => {
    expect(parseVersionProfile({
      id: 'build-metadata',
      nodeVersion: '22.21.1+verified.1',
      versions: {
        ...runtimeVersions,
        nuxt: '4.5.2+verified.1',
        nuxtContent: '3.15.2',
      },
    }).versions.nuxt).toBe('4.5.2+verified.1')
  })
})
