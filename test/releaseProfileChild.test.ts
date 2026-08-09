import { createHash } from 'node:crypto'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  parseReleaseProfileArguments,
  runReleaseProfileChild,
} from '../scripts/release-verification/release-profile.mjs'
import { ReleaseVerificationFailure } from '../scripts/release-verification/runner.mjs'
import type { PackageArtifactEvidence } from '../scripts/release-verification/runner.mjs'

const profile = {
  id: 'v3-minimum',
  nodeVersion: '22.19.0',
  versions: {
    betterSqlite3: '12.11.1',
    nuxt: '4.1.0',
    nuxtContent: '3.5.0',
    mermaid: '11.16.1',
    typescript: '5.9.3',
    vueTsc: '3.2.5',
  },
  expectedResolutions: {
    nuxtKit: '4.5.2',
    nuxtSchema: '4.5.2',
  },
}

const artifact = {
  archivePath: '/repo/.release-evidence/3.0.0/package.tgz',
  filename: 'package.tgz',
  sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  integritySha512: 'sha512-cmVsZWFzZS1hcnRpZmFjdA==',
  packlist: ['dist/module.mjs', 'dist/types.d.mts', 'package.json'],
  packageName: '@barzhsieh/nuxt-content-mermaid',
  packageVersion: '3.0.0',
}

function createPassedEvidence(requestedArtifact = artifact) {
  return {
    schemaVersion: 1,
    success: true,
    mode: 'package-artifact',
    package: {
      name: requestedArtifact.packageName,
      version: requestedArtifact.packageVersion,
    },
    artifact: {
      filename: requestedArtifact.filename,
      sha256: requestedArtifact.sha256,
    },
    profile: {
      id: profile.id,
      requested: profile.versions,
      resolved: profile.versions,
      expectedResolutions: {
        requested: profile.expectedResolutions,
        resolved: profile.expectedResolutions,
      },
    },
    runtime: {
      requested: profile.nodeVersion,
      observed: profile.nodeVersion,
    },
    stages: [],
  } satisfies PackageArtifactEvidence
}

const temporaryDirectories: string[] = []

async function createProtocolFiles() {
  const directory = await mkdtemp(join(tmpdir(), 'release-profile-child-test-'))
  temporaryDirectories.push(directory)
  const requestPath = join(directory, 'request.json')
  const resultPath = join(directory, 'result.json')
  const archiveBytes = Buffer.from('frozen publishable package artifact')
  const archivePath = join(directory, artifact.filename)
  await writeFile(archivePath, archiveBytes)
  const requestedArtifact = {
    ...artifact,
    archivePath,
    sha256: createHash('sha256').update(archiveBytes).digest('hex'),
    integritySha512: `sha512-${createHash('sha512').update(archiveBytes).digest('base64')}`,
  }
  await writeFile(requestPath, JSON.stringify({
    schemaVersion: 1,
    artifact: requestedArtifact,
    profile,
  }), 'utf8')
  return { archivePath, artifact: requestedArtifact, requestPath, resultPath }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => (
    rm(directory, { recursive: true, force: true })
  )))
})

describe('release profile child protocol', () => {
  it('accepts only absolute request and result file paths', () => {
    expect(parseReleaseProfileArguments([
      '--request', '/tmp/request.json',
      '--result', '/tmp/result.json',
    ])).toEqual({
      requestPath: '/tmp/request.json',
      resultPath: '/tmp/result.json',
    })

    expect(() => parseReleaseProfileArguments([
      '--request', 'request.json',
      '--result', '/tmp/result.json',
    ])).toThrow('absolute')
    expect(() => parseReleaseProfileArguments([
      '--request', '/tmp/request.json',
      '--result', '/tmp/request.json',
    ])).toThrow('different files')
    expect(() => parseReleaseProfileArguments([
      '--request', '/tmp/request.json',
      '--result', '/tmp/result.json',
      '--profile', 'v3-minimum',
    ])).toThrow('Unknown option')
  })

  it('verifies the complete frozen request and atomically writes result evidence', async () => {
    const { artifact: requestedArtifact, requestPath, resultPath } = await createProtocolFiles()
    const passedEvidence = createPassedEvidence(requestedArtifact)
    const verifier = vi.fn(async () => passedEvidence)

    await expect(runReleaseProfileChild({
      requestPath,
      resultPath,
      verifier,
    })).resolves.toEqual(passedEvidence)

    expect(verifier).toHaveBeenCalledWith({
      packageSource: { kind: 'retained', artifact: requestedArtifact },
      profile,
    }, expect.any(Object))
    await expect(readFile(resultPath, 'utf8'))
      .resolves.toBe(`${JSON.stringify(passedEvidence, null, 2)}\n`)
    await expect(access(`${resultPath}.tmp`)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('atomically preserves failed verifier evidence for the parent', async () => {
    const { artifact: requestedArtifact, requestPath, resultPath } = await createProtocolFiles()
    const passedEvidence = createPassedEvidence(requestedArtifact)
    const failedEvidence = {
      ...passedEvidence,
      success: false,
      stages: [{ name: 'build', status: 'failed', error: 'build failed' }],
    } satisfies PackageArtifactEvidence
    const failure = new ReleaseVerificationFailure(
      'build',
      new Error('build failed'),
      failedEvidence,
    )

    await expect(runReleaseProfileChild({
      requestPath,
      resultPath,
      verifier: vi.fn(async () => { throw failure }),
    })).rejects.toBe(failure)

    await expect(readFile(resultPath, 'utf8'))
      .resolves.toBe(`${JSON.stringify(failedEvidence, null, 2)}\n`)
    await expect(access(`${resultPath}.tmp`)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects artifact bytes that no longer match the frozen identity', async () => {
    const { archivePath, requestPath, resultPath } = await createProtocolFiles()
    await writeFile(archivePath, 'different artifact bytes', 'utf8')
    const verifier = vi.fn()

    await expect(runReleaseProfileChild({
      requestPath,
      resultPath,
      verifier,
    })).rejects.toThrow('SHA-256')

    expect(verifier).not.toHaveBeenCalled()
    await expect(access(resultPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects a frozen SHA-512 identity that does not match the artifact', async () => {
    const { requestPath, resultPath } = await createProtocolFiles()
    const request = JSON.parse(await readFile(requestPath, 'utf8'))
    request.artifact.integritySha512 = 'sha512-ZGlmZmVyZW50'
    await writeFile(requestPath, JSON.stringify(request), 'utf8')
    const verifier = vi.fn()

    await expect(runReleaseProfileChild({
      requestPath,
      resultPath,
      verifier,
    })).rejects.toThrow('SHA-512')

    expect(verifier).not.toHaveBeenCalled()
    await expect(access(resultPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
