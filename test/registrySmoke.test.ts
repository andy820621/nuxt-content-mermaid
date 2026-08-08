import { describe, expect, it, vi } from 'vitest'
import {
  ReleaseVerificationPackageUserError,
  classifyRegistrySmokeFailure,
} from '../scripts/release-verification/failure-classification.mjs'
import { RegistrySmokeVerificationFailure } from '../scripts/release-verification/runner.mjs'
import {
  createPendingRegistryHealth,
  runInitialRegistrySmoke,
} from '../scripts/release-verification/registry-smoke.mjs'

describe('registry smoke failure classification', () => {
  it.each([
    [Object.assign(new Error('npm registry unavailable'), { code: 'E503' }), 'registry'],
    [Object.assign(new Error('network unreachable'), { code: 'ENETUNREACH' }), 'network'],
    [Object.assign(new Error('spawn browser ENOENT'), { code: 'ENOENT' }), 'runner'],
    [Object.assign(new Error('permission denied'), { code: 'EACCES' }), 'permission'],
    [new ReleaseVerificationPackageUserError('SVG is empty'), 'package-defect'],
  ])('classifies %s as %s', (error, expected) => {
    expect(classifyRegistrySmokeFailure(error)).toBe(expected)
  })
})

const actualLatestProfile = {
  id: 'nuxt-4-actual-latest-release',
  versions: {
    betterSqlite3: '12.11.1',
    nuxt: '4.5.3',
    nuxtContent: '3.15.2',
    mermaid: '11.12.3',
    typescript: '5.9.3',
    vueTsc: '3.2.5',
  },
}

function createRegistryHealth() {
  return createPendingRegistryHealth({
    packageName: '@barzhsieh/nuxt-content-mermaid',
    packageVersion: '3.0.0',
    requestedProfile: {
      nuxt: '>=4.1.0 <5.0.0',
      nuxtContent: '>=3.5.0 <4.0.0',
    },
    profile: actualLatestProfile,
  })
}

function createVerificationEvidence(success: boolean) {
  return {
    schemaVersion: 1 as const,
    success,
    mode: 'registry-smoke' as const,
    package: {
      name: '@barzhsieh/nuxt-content-mermaid',
      requestedVersion: '3.0.0',
      resolvedVersion: success ? '3.0.0' : null,
    },
    profile: {
      id: actualLatestProfile.id,
      requested: actualLatestProfile.versions,
      resolved: success ? actualLatestProfile.versions : null,
    },
    stages: [],
  }
}

describe('initial registry smoke health', () => {
  it('records a successful clean attempt as healthy', async () => {
    const registryHealth = createRegistryHealth()
    const verification = createVerificationEvidence(true)
    const verifyRegistryPackage = vi.fn(async () => verification)

    await expect(runInitialRegistrySmoke({
      registryHealth,
      verifyRegistryPackage,
      now: () => '2026-08-09T01:00:00.000Z',
    })).resolves.toMatchObject({
      status: 'healthy',
      package: {
        name: '@barzhsieh/nuxt-content-mermaid',
        version: '3.0.0',
      },
      profile: {
        id: 'nuxt-4-actual-latest-release',
        requested: {
          nuxt: '>=4.1.0 <5.0.0',
          nuxtContent: '>=3.5.0 <4.0.0',
        },
        resolved: actualLatestProfile.versions,
      },
      attempts: [{
        number: 1,
        completedAt: '2026-08-09T01:00:00.000Z',
        cleanConsumer: true,
        success: true,
        stage: null,
        classification: null,
        verification,
      }],
      retryCommand: null,
    })
    expect(verifyRegistryPackage).toHaveBeenCalledWith({
      packageName: '@barzhsieh/nuxt-content-mermaid',
      packageVersion: '3.0.0',
      profile: actualLatestProfile,
    })
  })

  it.each([
    [Object.assign(new Error('network unreachable'), { code: 'ENETUNREACH' }), 'network'],
    [new ReleaseVerificationPackageUserError('SVG is empty'), 'package-defect'],
  ])('records a first %s failure for investigation without throwing', async (cause, classification) => {
    const registryHealth = createRegistryHealth()
    const verification = createVerificationEvidence(false)
    const verifyRegistryPackage = vi.fn(async () => {
      throw new RegistrySmokeVerificationFailure('runtime', cause, verification)
    })

    await expect(runInitialRegistrySmoke({
      registryHealth,
      verifyRegistryPackage,
      now: () => '2026-08-09T01:00:00.000Z',
    })).resolves.toMatchObject({
      status: 'investigation',
      package: {
        name: '@barzhsieh/nuxt-content-mermaid',
        version: '3.0.0',
      },
      profile: {
        id: 'nuxt-4-actual-latest-release',
        requested: {
          nuxt: '>=4.1.0 <5.0.0',
          nuxtContent: '>=3.5.0 <4.0.0',
        },
        resolved: actualLatestProfile.versions,
      },
      attempts: [{
        number: 1,
        completedAt: '2026-08-09T01:00:00.000Z',
        cleanConsumer: true,
        success: false,
        stage: 'runtime',
        classification,
        verification,
      }],
      retryCommand: 'pnpm release registry-smoke 3.0.0',
    })
  })
})
