import { describe, expect, it } from 'vitest'
import {
  VERSION_PROFILES,
  parseVersionProfile,
  selectVersionProfile,
} from '../scripts/release-verification/profiles.mjs'

const runtimeVersions = {
  betterSqlite3: '12.11.1',
  mermaid: '11.17.0',
  typescript: '5.9.3',
  vueTsc: '3.2.5',
}

describe('release verification Version Profiles', () => {
  it('declares one exact Node runtime for every profile', () => {
    expect(Object.values(VERSION_PROFILES).map(profile => profile.nodeVersion))
      .toEqual(['22.19.0', '24.19.0'])

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

  it('defines independently selectable final 3.x compatibility profiles', () => {
    expect(Object.keys(VERSION_PROFILES)).toEqual([
      'v3-minimum',
      'v3-known-latest',
    ])
    expect(VERSION_PROFILES['v3-minimum']).toEqual({
      id: 'v3-minimum',
      nodeVersion: '22.19.0',
      versions: {
        ...runtimeVersions,
        nuxt: '4.1.0',
        nuxtContent: '3.5.0',
      },
      expectedResolutions: {
        nuxtKit: '4.5.2',
        nuxtSchema: '4.5.2',
      },
    })
    expect(VERSION_PROFILES['v3-known-latest']).toEqual({
      id: 'v3-known-latest',
      nodeVersion: '24.19.0',
      versions: {
        ...runtimeVersions,
        nuxt: '4.5.2',
        nuxtContent: '3.15.2',
      },
      expectedResolutions: {
        nuxtKit: '4.5.2',
        nuxtSchema: '4.5.2',
      },
    })
    expect(selectVersionProfile('v3-minimum')).toBe(VERSION_PROFILES['v3-minimum'])
    expect(selectVersionProfile('v3-known-latest')).toBe(VERSION_PROFILES['v3-known-latest'])
  })

  it('rejects an unknown profile selection', () => {
    expect(() => selectVersionProfile('missing')).toThrow('Unknown Version Profile: missing')
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

  it.each([
    ['missing expected resolution', { nuxtKit: '4.5.2' }],
    ['extra expected resolution', {
      nuxtKit: '4.5.2',
      nuxtSchema: '4.5.2',
      other: '1.0.0',
    }],
    ['ranged expected resolution', {
      nuxtKit: '^4.5.2',
      nuxtSchema: '4.5.2',
    }],
  ])('rejects a profile with a %s', (_label, expectedResolutions) => {
    expect(() => parseVersionProfile({
      id: 'invalid-resolutions',
      nodeVersion: '22.19.0',
      versions: {
        ...runtimeVersions,
        nuxt: '4.1.0',
        nuxtContent: '3.5.0',
      },
      expectedResolutions,
    })).toThrow('Invalid Version Profile')
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
