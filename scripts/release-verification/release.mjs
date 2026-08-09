#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import {
  mkdir as mkdirOnDisk,
  mkdtemp as mkdtempOnDisk,
  readFile as readFileFromDisk,
  rename as renameOnDisk,
  rm as rmOnDisk,
  writeFile as writeFileOnDisk,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import {
  createReleaseVerificationOperations,
  runCommand,
} from './operations.mjs'
import { parseExactSemver } from './exact-semver.mjs'
import { parseVersionProfile, VERSION_PROFILES } from './profiles.mjs'
import {
  CompatibilityMatrixVerificationFailure,
  runPackageArtifactMatrixVerification,
  runRegistrySmokeVerification,
} from './runner.mjs'
import {
  createPendingRegistryHealth,
  runInitialRegistrySmoke,
  runRegistrySmokeRetry,
} from './registry-smoke.mjs'

const MANUAL_CHECKS = Object.freeze([
  'fullscreen',
  'zoomPanDrag',
  'clipboard',
  'mobileInteraction',
  'visualReadability',
])
const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const RELEASE_PROFILE_IDS = Object.freeze(['v3-minimum', 'v3-known-latest'])
const RELEASE_KNOWN_LATEST_PROFILE_ID = 'v3-known-latest'

function frozenReleaseProfiles() {
  return RELEASE_PROFILE_IDS.map(id => parseVersionProfile(VERSION_PROFILES[id]))
}

function snapshotReleaseManifest(manifest) {
  const snapshot = {
    engines: { node: manifest.engines?.node },
    peerDependencies: {
      '@nuxt/content': manifest.peerDependencies?.['@nuxt/content'],
      'nuxt': manifest.peerDependencies?.nuxt,
    },
    dependencies: {
      '@nuxt/kit': manifest.dependencies?.['@nuxt/kit'],
      'mermaid': manifest.dependencies?.mermaid,
    },
  }
  const missingField = [
    ['engines.node', snapshot.engines.node],
    ['peerDependencies.@nuxt/content', snapshot.peerDependencies['@nuxt/content']],
    ['peerDependencies.nuxt', snapshot.peerDependencies.nuxt],
    ['dependencies.@nuxt/kit', snapshot.dependencies['@nuxt/kit']],
    ['dependencies.mermaid', snapshot.dependencies.mermaid],
  ].find(([, value]) => typeof value !== 'string' || !value)
  if (missingField) {
    throw new Error(`Retained artifact manifest is missing ${missingField[0]}`)
  }
  return snapshot
}

function assertExactSemver(version) {
  if (!parseExactSemver(version)) {
    throw new Error('Release entrypoint requires an exact target SemVer')
  }
}

function compareSemvers(left, right) {
  const leftMatch = parseExactSemver(left)
  const rightMatch = parseExactSemver(right)
  if (!leftMatch || !rightMatch) throw new Error('Cannot compare invalid SemVer values')
  const leftCore = leftMatch.slice(1, 4).map(Number)
  const rightCore = rightMatch.slice(1, 4).map(Number)
  for (let index = 0; index < 3; index++) {
    if (leftCore[index] !== rightCore[index]) {
      return leftCore[index] > rightCore[index] ? 1 : -1
    }
  }
  const leftPrerelease = leftMatch[4]?.split('.')
  const rightPrerelease = rightMatch[4]?.split('.')
  if (!leftPrerelease && !rightPrerelease) return 0
  if (!leftPrerelease) return 1
  if (!rightPrerelease) return -1
  const identifierCount = Math.max(leftPrerelease.length, rightPrerelease.length)
  for (let index = 0; index < identifierCount; index++) {
    const leftIdentifier = leftPrerelease[index]
    const rightIdentifier = rightPrerelease[index]
    if (leftIdentifier === undefined) return -1
    if (rightIdentifier === undefined) return 1
    if (leftIdentifier === rightIdentifier) continue
    const leftIsNumeric = /^\d+$/.test(leftIdentifier)
    const rightIsNumeric = /^\d+$/.test(rightIdentifier)
    if (leftIsNumeric && rightIsNumeric) {
      return Number(leftIdentifier) > Number(rightIdentifier) ? 1 : -1
    }
    if (leftIsNumeric !== rightIsNumeric) return leftIsNumeric ? -1 : 1
    return leftIdentifier > rightIdentifier ? 1 : -1
  }
  return 0
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

async function recordBlockedEvidence({
  effects,
  evidence,
  error,
  stage,
  status = 'blocked',
  timestamp = effects.now(),
}) {
  evidence.status = status
  evidence.timestamps.blockedAt = timestamp
  evidence.blocked = {
    stage,
    message: errorMessage(error),
  }
  await effects.writeEvidence(evidence)
}

async function recordRegistryHealth({ effects, evidence }) {
  if (evidence.registryHealth !== undefined) return evidence

  const registryRelease = await effects.readRegistryRelease({
    packageName: evidence.artifact?.packageName,
    targetVersion: evidence.artifact?.packageVersion,
  })
  if (registryRelease?.state !== 'published'
    || registryRelease.integrity !== evidence.identity?.artifactIntegritySha512) {
    throw new Error('Registry smoke requires npm to match the frozen artifact identity')
  }

  const profile = evidence.releaseBaseline?.profiles?.find(candidate => (
    candidate.id === RELEASE_KNOWN_LATEST_PROFILE_ID
  ))
  const verification = evidence.compatibilityProfiles?.find(candidate => (
    candidate.id === RELEASE_KNOWN_LATEST_PROFILE_ID && candidate.success === true
  ))
  if (!profile || !verification) {
    throw new Error('Registry smoke requires frozen Known-Latest Compatibility Profile evidence')
  }
  const coordinatesMatch = isDeepStrictEqual(verification.requested, profile.versions)
    && isDeepStrictEqual(verification.resolved, profile.versions)
    && verification.runtime?.requested === profile.nodeVersion
    && verification.runtime?.observed === profile.nodeVersion
    && isDeepStrictEqual(
      verification.expectedResolutions?.requested,
      profile.expectedResolutions,
    )
    && isDeepStrictEqual(
      verification.expectedResolutions?.resolved,
      profile.expectedResolutions,
    )
  if (!coordinatesMatch) {
    throw new Error('Registry smoke Compatibility Profile evidence does not match the freeze')
  }
  evidence.registryHealth = createPendingRegistryHealth({
    packageName: evidence.artifact?.packageName,
    packageVersion: evidence.artifact?.packageVersion,
    requestedProfile: {
      nuxt: profile.versions.nuxt,
      nuxtContent: profile.versions.nuxtContent,
    },
    profile,
  })
  await effects.writeEvidence(evidence)
  evidence.registryHealth = await runInitialRegistrySmoke({
    registryHealth: evidence.registryHealth,
    verifyRegistryPackage: effects.verifyRegistryPackage,
    now: effects.now,
  })
  await effects.writeEvidence(evidence)
  return evidence
}

async function availablePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  await new Promise((resolve, reject) => server.close(error => (
    error ? reject(error) : resolve()
  )))
  if (!address || typeof address === 'string') {
    throw new Error('Unable to allocate a manual verification port')
  }
  return address.port
}

async function waitForConsumer(url, child) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Manual consumer exited before becoming ready (${child.exitCode})`)
    }
    try {
      const response = await fetch(url)
      if (response.ok) return
    }
    catch {
      // The server has not opened its socket yet.
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error('Manual consumer did not become ready within 30 seconds')
}

async function stopConsumer(child) {
  if (child.exitCode !== null) return
  const exited = once(child, 'exit')
  child.kill('SIGTERM')
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), 2_000)),
  ])
  if (!stopped && child.exitCode === null) child.kill('SIGKILL')
}

function runProfileProcess({ command, args, cwd }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' })
    child.once('error', rejectPromise)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      const reason = signal ? `signal ${signal}` : `exit code ${code}`
      rejectPromise(new Error(`Release profile child failed with ${reason}`))
    })
  })
}

async function runManualInteractionChecks({ checks, consumerDirectory }) {
  const port = await availablePort()
  const url = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: consumerDirectory,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
    },
    stdio: 'inherit',
  })
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  try {
    await waitForConsumer(url, child)
    process.stdout.write(`\nManual release consumer: ${url}\n`)
    const results = {}
    for (const check of checks) {
      const answer = await prompt.question(`${check} passed? [y/N] `)
      results[check] = /^(?:y|yes)$/i.test(answer.trim())
    }
    return results
  }
  finally {
    prompt.close()
    await stopConsumer(child)
  }
}

export function createReleaseEffects({
  artifactCreator,
  clock = () => new Date(),
  commandRunner = runCommand,
  filesystem = {},
  manualInteractionRunner = runManualInteractionChecks,
  matrixVerifier = runPackageArtifactMatrixVerification,
  profileProcessRunner = runProfileProcess,
  registryVerifier = runRegistrySmokeVerification,
  repositoryRoot = process.cwd(),
  targetVersion,
  temporaryRoot = tmpdir(),
  verificationOperations: injectedVerificationOperations,
} = {}) {
  const readFile = filesystem.readFile ?? readFileFromDisk
  const mkdir = filesystem.mkdir ?? mkdirOnDisk
  const mkdtemp = filesystem.mkdtemp ?? mkdtempOnDisk
  const rename = filesystem.rename ?? renameOnDisk
  const rm = filesystem.rm ?? rmOnDisk
  const writeFile = filesystem.writeFile ?? writeFileOnDisk
  const verificationOperations = injectedVerificationOperations
    ?? createReleaseVerificationOperations({
      commandRunner,
      templateDirectory: join(MODULE_DIRECTORY, '../../test/release-verification/consumer-template'),
      temporaryRoot,
    })
  const createArtifact = artifactCreator ?? verificationOperations.createArtifact
  const preparedBranches = new Map()

  function evidencePath(root, version) {
    assertExactSemver(version)
    return join(root, '.release-evidence', version, 'release.json')
  }

  async function writeEvidenceFile(evidence) {
    const path = evidencePath(repositoryRoot, targetVersion)
    const temporaryPath = `${path}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, path)
  }

  async function readRegistryVersions(packageName) {
    const result = await commandRunner({
      command: 'npm',
      args: ['view', packageName, 'versions', '--json'],
      cwd: repositoryRoot,
    })
    const parsed = JSON.parse(String(result?.stdout ?? ''))
    const versions = Array.isArray(parsed) ? parsed : [parsed]
    if (versions.some(version => typeof version !== 'string')) {
      throw new Error(`Registry returned invalid versions for ${packageName}`)
    }
    return versions
  }

  async function verifyFrozenProfile({ artifact, profile }) {
    const protocolDirectory = await mkdtemp(join(
      temporaryRoot,
      'nuxt-content-mermaid-release-profile-',
    ))
    const requestPath = join(protocolDirectory, 'request.json')
    const requestTemporaryPath = `${requestPath}.tmp`
    const resultPath = join(protocolDirectory, 'result.json')
    let processError
    try {
      await writeFile(requestTemporaryPath, `${JSON.stringify({
        schemaVersion: 1,
        artifact,
        profile,
      }, null, 2)}\n`, 'utf8')
      await rename(requestTemporaryPath, requestPath)
      try {
        await profileProcessRunner({
          command: 'volta',
          args: [
            'run',
            '--node',
            profile.nodeVersion,
            'node',
            join(MODULE_DIRECTORY, 'release-profile.mjs'),
            '--request',
            requestPath,
            '--result',
            resultPath,
          ],
          cwd: repositoryRoot,
        })
      }
      catch (error) {
        processError = error
      }

      let evidence
      try {
        evidence = JSON.parse(await readFile(resultPath, 'utf8'))
      }
      catch (error) {
        if (processError) {
          throw new AggregateError(
            [processError, error],
            `Release profile child ${profile.id} failed without result evidence`,
            { cause: error },
          )
        }
        throw error
      }
      if (processError && evidence?.success === true) {
        throw new AggregateError(
          [processError],
          `Release profile child ${profile.id} failed after reporting success`,
        )
      }
      return evidence
    }
    finally {
      await rm(protocolDirectory, { recursive: true, force: true })
    }
  }

  return {
    now: () => clock().toISOString(),
    runCommand: invocation => commandRunner(invocation),
    async prepareRelease({
      changeHeadCommit,
      repositoryRoot: root,
      targetVersion: version,
    }) {
      assertExactSemver(version)
      const temporaryDirectory = await mkdtemp(join(temporaryRoot, 'nuxt-content-mermaid-release-'))
      const worktreeDirectory = join(temporaryDirectory, 'worktree')
      const branchName = `release-prep/v${version}-${basename(temporaryDirectory)}`
      const artifactDirectory = join(root, '.release-evidence', version, 'pack')
      const changelogenCommand = join(
        root,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'changelogen.cmd' : 'changelogen',
      )
      let worktreeAdded = false
      let succeeded = false
      try {
        await commandRunner({
          command: 'git',
          args: ['worktree', 'add', '-b', branchName, worktreeDirectory, changeHeadCommit],
          cwd: root,
        })
        worktreeAdded = true
        await commandRunner({
          command: changelogenCommand,
          args: ['--release', '-r', version, '--no-commit', '--no-tag'],
          cwd: worktreeDirectory,
        })
        await commandRunner({
          command: 'pnpm',
          args: ['install', '--lockfile-only', '--ignore-scripts'],
          cwd: worktreeDirectory,
        })
        await commandRunner({ command: 'git', args: ['add', '-A'], cwd: worktreeDirectory })
        await commandRunner({
          command: 'git',
          args: ['commit', '-m', `chore(release): v${version}`],
          cwd: worktreeDirectory,
        })
        const commitResult = await commandRunner({
          command: 'git',
          args: ['rev-parse', 'HEAD'],
          cwd: worktreeDirectory,
        })
        const sourceCommit = String(commitResult?.stdout ?? '').trim()
        if (!sourceCommit) throw new Error('Release preparation did not resolve its commit')
        await commandRunner({
          command: 'pnpm',
          args: ['install', '--frozen-lockfile', '--ignore-scripts'],
          cwd: worktreeDirectory,
        })
        await mkdir(artifactDirectory, { recursive: true })
        const artifact = await createArtifact({
          artifactDirectory,
          repositoryRoot: worktreeDirectory,
        })
        const archivePath = join(root, '.release-evidence', version, artifact.filename)
        await rename(artifact.archivePath, archivePath)
        await rm(artifactDirectory, { recursive: true, force: true })
        preparedBranches.set(sourceCommit, branchName)
        succeeded = true
        return {
          sourceCommit,
          artifact: {
            ...artifact,
            archivePath,
          },
        }
      }
      finally {
        if (worktreeAdded) {
          await commandRunner({
            command: 'git',
            args: ['worktree', 'remove', '--force', worktreeDirectory],
            cwd: root,
          })
        }
        await rm(temporaryDirectory, { recursive: true, force: true })
        if (!succeeded && worktreeAdded) {
          await commandRunner({
            command: 'git',
            args: ['branch', '-D', branchName],
            cwd: root,
          })
        }
      }
    },
    async readReleaseManifestSnapshot({ artifact }) {
      const result = await commandRunner({
        command: 'tar',
        args: ['-xOf', artifact.archivePath, 'package/package.json'],
        cwd: repositoryRoot,
      })
      const manifest = JSON.parse(String(result?.stdout ?? ''))
      return snapshotReleaseManifest(manifest)
    },
    verifyArtifactProfiles: ({ artifact, profiles }) => matrixVerifier({
      artifact,
      profiles,
    }, verifyFrozenProfile),
    verifyRegistryPackage: request => registryVerifier(request, verificationOperations),
    async runManualCheck({ artifact, profile, checks }) {
      const workspace = await verificationOperations.createWorkspace()
      let result
      let primaryFailure
      try {
        await verificationOperations.installConsumer({
          packageSource: { kind: 'artifact', artifact },
          consumerDirectory: workspace.consumerDirectory,
          profile,
        })
        await verificationOperations.buildConsumer({
          consumerDirectory: workspace.consumerDirectory,
        })
        result = await manualInteractionRunner({
          checks,
          consumerDirectory: workspace.consumerDirectory,
        })
      }
      catch (error) {
        primaryFailure = error
      }
      try {
        await verificationOperations.cleanupWorkspace(workspace.root)
      }
      catch (cleanupError) {
        if (!primaryFailure) throw cleanupError
        throw new AggregateError(
          [primaryFailure, cleanupError],
          'Manual verification and workspace cleanup both failed',
          { cause: cleanupError },
        )
      }
      if (primaryFailure) throw primaryFailure
      return result
    },
    async assertReleaseIdentity({
      phase,
      repositoryRoot: root,
      changeHeadCommit,
      identity,
      artifact,
      releaseBaseline,
      tagName,
    }) {
      if (!['fast-forward', 'tag', 'push', 'publish', 'reconcile'].includes(phase)) {
        throw new Error(`Unknown release identity phase: ${phase}`)
      }
      assertExactSemver(identity?.targetVersion)
      if (typeof identity?.sourceCommit !== 'string' || !identity.sourceCommit) {
        throw new Error('Release identity is missing its source commit')
      }
      if (tagName !== `v${identity.targetVersion}`) {
        throw new Error('Release tag does not match the target version')
      }
      if (artifact?.packageVersion !== identity.targetVersion
        || typeof artifact?.packageName !== 'string'
        || !artifact.packageName) {
        throw new Error('Retained tarball identity does not match the release target')
      }
      const expectedArchivePath = join(
        root,
        '.release-evidence',
        identity.targetVersion,
        artifact.filename,
      )
      if (artifact.archivePath !== expectedArchivePath) {
        throw new Error('Retained tarball path does not match release evidence')
      }
      if (artifact.integritySha512 !== identity.artifactIntegritySha512) {
        throw new Error('Retained tarball integrity does not match release identity')
      }

      const archiveBytes = await readFile(artifact.archivePath)
      const actualSha256 = createHash('sha256').update(archiveBytes).digest('hex')
      if (actualSha256 !== artifact.sha256) {
        throw new Error('Retained tarball SHA-256 changed after verification')
      }
      const actualIntegrity = `sha512-${createHash('sha512').update(archiveBytes).digest('base64')}`
      if (actualIntegrity !== identity.artifactIntegritySha512) {
        throw new Error('Retained tarball integrity changed after verification')
      }
      const archiveManifestResult = await commandRunner({
        command: 'tar',
        args: ['-xOf', artifact.archivePath, 'package/package.json'],
        cwd: root,
      })
      const archiveManifest = JSON.parse(String(archiveManifestResult?.stdout ?? ''))
      if (archiveManifest.name !== artifact.packageName
        || archiveManifest.version !== identity.targetVersion) {
        throw new Error('Retained tarball manifest does not match release identity')
      }
      if (!isDeepStrictEqual(
        snapshotReleaseManifest(archiveManifest),
        releaseBaseline?.manifest,
      )) {
        throw new Error('Retained tarball manifest changed after the release baseline freeze')
      }
      if (!isDeepStrictEqual(releaseBaseline?.profiles, frozenReleaseProfiles())) {
        throw new Error('Compatibility Profiles changed after the release baseline freeze')
      }

      const branchResult = await commandRunner({
        command: 'git',
        args: ['branch', '--show-current'],
        cwd: root,
      })
      const statusResult = await commandRunner({
        command: 'git',
        args: ['status', '--porcelain=v1', '--untracked-files=all'],
        cwd: root,
      })
      const headResult = await commandRunner({
        command: 'git',
        args: ['rev-parse', 'HEAD'],
        cwd: root,
      })
      if (String(branchResult?.stdout ?? '').trim() !== 'main') {
        throw new Error('Formal release branch is no longer main')
      }
      if (String(statusResult?.stdout ?? '').trim() !== '') {
        throw new Error('Formal release worktree is no longer clean')
      }
      const head = String(headResult?.stdout ?? '').trim()

      if (phase === 'fast-forward') {
        if (head !== changeHeadCommit) {
          throw new Error('Formal branch changed after source verification')
        }
        const preparedManifestResult = await commandRunner({
          command: 'git',
          args: ['show', `${identity.sourceCommit}:package.json`],
          cwd: root,
        })
        const preparedManifest = JSON.parse(String(preparedManifestResult?.stdout ?? ''))
        if (preparedManifest.name !== artifact.packageName
          || preparedManifest.version !== identity.targetVersion) {
          throw new Error('Prepared commit manifest does not match release identity')
        }
        return
      }

      if (head !== identity.sourceCommit) {
        throw new Error('Formal branch does not resolve to the prepared release commit')
      }
      const formalManifest = JSON.parse(String(await readFile(join(root, 'package.json'), 'utf8')))
      if (formalManifest.name !== artifact.packageName
        || formalManifest.version !== identity.targetVersion) {
        throw new Error('Formal package manifest does not match release identity')
      }
      if (phase === 'tag') {
        const existingTagResult = await commandRunner({
          command: 'git',
          args: ['tag', '--list', tagName],
          cwd: root,
        })
        if (String(existingTagResult?.stdout ?? '').trim() !== '') {
          throw new Error(`Release tag already exists: ${tagName}`)
        }
        return
      }
      const tagCommitResult = await commandRunner({
        command: 'git',
        args: ['rev-list', '-n', '1', tagName],
        cwd: root,
      })
      if (String(tagCommitResult?.stdout ?? '').trim() !== identity.sourceCommit) {
        throw new Error('Release tag does not resolve to the prepared release commit')
      }
    },
    async initializeEvidence(evidence) {
      if (!targetVersion) {
        throw new Error('Release effects require a target version to initialize evidence')
      }
      await mkdir(join(repositoryRoot, '.release-evidence'), { recursive: true })
      try {
        await mkdir(join(repositoryRoot, '.release-evidence', targetVersion))
      }
      catch (error) {
        if (error && typeof error === 'object' && error.code === 'EEXIST') {
          throw new Error(
            `Release evidence directory already exists for ${targetVersion}; inspect and remove or move the entire directory before retrying`,
            { cause: error },
          )
        }
        throw error
      }
      await writeEvidenceFile(evidence)
    },
    async writeEvidence(evidence) {
      if (!targetVersion) {
        throw new Error('Release effects require a target version to write evidence')
      }
      await writeEvidenceFile(evidence)
    },
    async readEvidence({ repositoryRoot: root, targetVersion: version }) {
      return JSON.parse(await readFile(evidencePath(root, version), 'utf8'))
    },
    async readRepositoryState({ repositoryRoot: cwd }) {
      const [branchResult, statusResult, headResult, manifestSource] = await Promise.all([
        commandRunner({
          command: 'git',
          args: ['branch', '--show-current'],
          cwd,
        }),
        commandRunner({
          command: 'git',
          args: ['status', '--porcelain=v1', '--untracked-files=all'],
          cwd,
        }),
        commandRunner({
          command: 'git',
          args: ['rev-parse', 'HEAD'],
          cwd,
        }),
        readFile(join(cwd, 'package.json'), 'utf8'),
      ])
      const manifest = JSON.parse(String(manifestSource))
      if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') {
        throw new TypeError('Repository package manifest is missing name or version')
      }
      return {
        branch: String(branchResult?.stdout ?? '').trim(),
        clean: String(statusResult?.stdout ?? '').trim() === '',
        head: String(headResult?.stdout ?? '').trim(),
        packageName: manifest.name,
        packageVersion: manifest.version,
      }
    },
    async readPublishedVersion({ packageName, targetVersion }) {
      const versions = await readRegistryVersions(packageName)
      return versions.includes(targetVersion) ? targetVersion : null
    },
    async readRegistryRelease({ packageName, targetVersion }) {
      const versions = await readRegistryVersions(packageName)
      if (!versions.includes(targetVersion)) return { state: 'absent' }
      const result = await commandRunner({
        command: 'npm',
        args: [
          'view',
          `${packageName}@${targetVersion}`,
          'dist.integrity',
          '--json',
        ],
        cwd: repositoryRoot,
      })
      const integrity = JSON.parse(String(result?.stdout ?? ''))
      if (typeof integrity !== 'string' || !integrity) {
        throw new Error(`Registry did not return integrity for ${packageName}@${targetVersion}`)
      }
      return { state: 'published', integrity }
    },
    async fastForward({ repositoryRoot: root, sourceCommit }) {
      await commandRunner({
        command: 'git',
        args: ['merge', '--ff-only', sourceCommit],
        cwd: root,
      })
      const branchName = preparedBranches.get(sourceCommit)
      if (branchName) {
        await commandRunner({
          command: 'git',
          args: ['branch', '-d', branchName],
          cwd: root,
        })
        preparedBranches.delete(sourceCommit)
      }
    },
    createTag: ({ repositoryRoot: cwd, sourceCommit, tagName }) => commandRunner({
      command: 'git',
      args: ['tag', '-a', tagName, sourceCommit, '-m', tagName],
      cwd,
    }),
    push: ({ branch, repositoryRoot: cwd, tagName }) => commandRunner({
      command: 'git',
      args: ['push', '--atomic', 'origin', branch, tagName],
      cwd,
    }),
    publish: ({ archivePath, distTag }) => commandRunner({
      command: 'npm',
      args: ['publish', archivePath, '--tag', distTag, '--ignore-scripts'],
      cwd: repositoryRoot,
    }),
  }
}

export function parseReleaseArguments(argv) {
  if (argv[0] === 'registry-smoke') {
    assertExactSemver(argv[1])
    if (argv.length !== 2) {
      throw new Error('Registry smoke retry does not accept options')
    }
    return {
      mode: 'registry-smoke-retry',
      targetVersion: argv[1],
    }
  }
  if (argv[0] === 'reconcile') {
    assertExactSemver(argv[1])
    if (argv.length !== 2) {
      throw new Error('Release reconciliation does not accept options')
    }
    return {
      mode: 'reconcile',
      targetVersion: argv[1],
    }
  }

  assertExactSemver(argv[0])
  if (argv.length > 1 && argv[1] !== '--skip-manual') {
    throw new Error(`Unknown release option: ${argv[1]}`)
  }
  const skipManualReason = argv[1] === '--skip-manual' ? argv[2] : null
  if (argv[1] === '--skip-manual'
    && (argv.length !== 3 || !skipManualReason.trim())) {
    throw new Error('--skip-manual requires a non-empty reason')
  }
  return {
    mode: 'release',
    targetVersion: argv[0],
    skipManualReason,
  }
}

export async function runReleaseGate({ request, repositoryRoot, effects }) {
  if (request.mode !== 'release') {
    throw new Error('Release gate requires a release request')
  }

  const repository = await effects.readRepositoryState({ repositoryRoot })
  if (repository.branch !== 'main') {
    throw new Error('Release must start from the formal main branch')
  }
  if (!repository.clean) {
    throw new Error('Release must start from a clean worktree')
  }

  assertExactSemver(repository.packageVersion)
  if (compareSemvers(request.targetVersion, repository.packageVersion) <= 0) {
    throw new Error('Target version must be newer than current version')
  }

  const publishedVersion = await effects.readPublishedVersion({
    packageName: repository.packageName,
    targetVersion: request.targetVersion,
  })
  if (publishedVersion !== null) {
    throw new Error(`Target version ${request.targetVersion} already exists in the registry`)
  }

  const startedAt = effects.now()
  const evidence = {
    schemaVersion: 1,
    status: 'preparing',
    changeHeadCommit: repository.head,
    sourceChecks: null,
    identity: null,
    releaseBaseline: null,
    compatibilityProfiles: [],
    manualCheck: null,
    timestamps: { startedAt },
  }
  await effects.initializeEvidence(evidence)

  try {
    const result = await effects.runCommand({
      command: 'pnpm',
      args: ['verify:source'],
      cwd: repositoryRoot,
    })
    if (!result || typeof result !== 'object') {
      throw new Error('source verification returned an indeterminate result')
    }
    const completedAt = effects.now()
    evidence.sourceChecks = {
      command: 'pnpm verify:source',
      passed: true,
      completedAt,
    }
    evidence.timestamps.sourceChecksCompletedAt = completedAt
    await effects.writeEvidence(evidence)
  }
  catch (error) {
    const completedAt = effects.now()
    evidence.sourceChecks = {
      command: 'pnpm verify:source',
      passed: false,
      completedAt,
    }
    await recordBlockedEvidence({
      effects,
      evidence,
      error,
      stage: 'source-verification',
      timestamp: completedAt,
    })
    throw new Error(`Release blocked during source verification: ${errorMessage(error)}`, {
      cause: error,
    })
  }

  let prepared
  try {
    prepared = await effects.prepareRelease({
      changeHeadCommit: repository.head,
      repositoryRoot,
      targetVersion: request.targetVersion,
    })
    if (typeof prepared?.sourceCommit !== 'string' || !prepared.sourceCommit) {
      throw new Error('Release preparation did not produce a prepared source commit')
    }
    if (prepared.artifact?.packageName !== repository.packageName
      || prepared.artifact?.packageVersion !== request.targetVersion) {
      throw new Error('Prepared tarball version or package name does not match the release target')
    }
    if (typeof prepared.artifact.archivePath !== 'string'
      || !prepared.artifact.archivePath
      || typeof prepared.artifact.filename !== 'string'
      || !prepared.artifact.filename
      || basename(prepared.artifact.archivePath) !== prepared.artifact.filename) {
      throw new Error('Prepared tarball archive path or filename is invalid')
    }
    if (typeof prepared.artifact.sha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(prepared.artifact.sha256)) {
      throw new Error('Prepared tarball does not have a valid SHA-256 digest')
    }
    if (typeof prepared.artifact.integritySha512 !== 'string'
      || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(prepared.artifact.integritySha512)) {
      throw new Error('Prepared tarball does not have valid npm SHA-512 integrity')
    }
    if (!Array.isArray(prepared.artifact.packlist)
      || prepared.artifact.packlist.some(path => typeof path !== 'string' || !path)) {
      throw new Error('Prepared tarball does not have a valid packlist')
    }
  }
  catch (error) {
    await recordBlockedEvidence({
      effects,
      evidence,
      error,
      stage: 'preparation',
    })
    throw error
  }
  evidence.identity = {
    sourceCommit: prepared.sourceCommit,
    targetVersion: request.targetVersion,
    artifactIntegritySha512: prepared.artifact.integritySha512,
  }
  evidence.artifact = {
    archivePath: prepared.artifact.archivePath,
    filename: prepared.artifact.filename,
    sha256: prepared.artifact.sha256,
    packageName: prepared.artifact.packageName,
    packageVersion: prepared.artifact.packageVersion,
    packlist: [...prepared.artifact.packlist],
  }
  const profiles = frozenReleaseProfiles()
  try {
    const manifest = await effects.readReleaseManifestSnapshot({
      artifact: prepared.artifact,
    })
    evidence.releaseBaseline = {
      manifest,
      profiles,
    }
    evidence.timestamps.preparedAt = effects.now()
    await effects.writeEvidence(evidence)
  }
  catch (error) {
    await recordBlockedEvidence({
      effects,
      evidence,
      error,
      stage: 'baseline-freeze',
    })
    throw new Error(`Release blocked during baseline freeze: ${errorMessage(error)}`, {
      cause: error,
    })
  }

  try {
    const verification = await effects.verifyArtifactProfiles({
      artifact: prepared.artifact,
      profiles,
    })
    if (!verification || verification.success !== true) {
      throw new Error('artifact verification returned an indeterminate result')
    }
    evidence.compatibilityProfiles = verification.profiles.map(profile => structuredClone(profile))
    evidence.timestamps.compatibilityVerifiedAt = effects.now()
    await effects.writeEvidence(evidence)
  }
  catch (error) {
    if (error instanceof CompatibilityMatrixVerificationFailure) {
      evidence.compatibilityProfiles = error.evidence.profiles.map(profile => (
        structuredClone(profile)
      ))
    }
    await recordBlockedEvidence({
      effects,
      evidence,
      error,
      stage: 'artifact-verification',
    })
    throw new Error(`Release blocked during artifact verification: ${errorMessage(error)}`, {
      cause: error,
    })
  }

  if (request.skipManualReason === null) {
    let results = null
    try {
      results = await effects.runManualCheck({
        artifact: prepared.artifact,
        profile: profiles.find(profile => profile.id === RELEASE_KNOWN_LATEST_PROFILE_ID),
        checks: [...MANUAL_CHECKS],
      })
      evidence.manualCheck = {
        required: true,
        reason: 'required by default',
        results: results && typeof results === 'object' ? { ...results } : null,
      }
      const failedChecks = MANUAL_CHECKS.filter(check => results?.[check] !== true)
      if (failedChecks.length > 0) {
        throw new Error(`manual verification did not pass: ${failedChecks.join(', ')}`)
      }
    }
    catch (error) {
      evidence.manualCheck ??= {
        required: true,
        reason: 'required by default',
        results: results && typeof results === 'object' ? { ...results } : null,
      }
      await recordBlockedEvidence({
        effects,
        evidence,
        error,
        stage: 'manual-verification',
      })
      throw new Error(`Release blocked during manual verification: ${errorMessage(error)}`, {
        cause: error,
      })
    }
  }
  else {
    evidence.manualCheck = {
      required: false,
      reason: request.skipManualReason,
      results: null,
    }
  }
  evidence.status = 'verified'
  evidence.timestamps.verifiedAt = effects.now()
  await effects.writeEvidence(evidence)

  const tagName = `v${request.targetVersion}`
  const identityCheck = phase => effects.assertReleaseIdentity({
    phase,
    repositoryRoot,
    changeHeadCommit: repository.head,
    identity: evidence.identity,
    artifact: prepared.artifact,
    releaseBaseline: evidence.releaseBaseline,
    tagName,
  })

  let publicationStage = 'publication-identity'
  try {
    await identityCheck('fast-forward')
    publicationStage = 'fast-forward'
    await effects.fastForward({
      repositoryRoot,
      sourceCommit: prepared.sourceCommit,
    })
    publicationStage = 'publication-identity'
    await identityCheck('tag')
    publicationStage = 'tag'
    await effects.createTag({
      repositoryRoot,
      sourceCommit: prepared.sourceCommit,
      tagName,
    })
    publicationStage = 'publication-identity'
    await identityCheck('push')
    publicationStage = 'push'
    await effects.push({
      branch: 'main',
      repositoryRoot,
      tagName,
    })
    evidence.status = 'pushed'
    evidence.timestamps.pushedAt = effects.now()
    await effects.writeEvidence(evidence)

    publicationStage = 'publication-identity'
    await identityCheck('publish')
    publicationStage = 'publish'
    await effects.publish({
      archivePath: prepared.artifact.archivePath,
      distTag: 'latest',
    })
    evidence.status = 'published'
    evidence.timestamps.publishedAt = effects.now()
    await effects.writeEvidence(evidence)
  }
  catch (error) {
    await recordBlockedEvidence({
      effects,
      evidence,
      error,
      stage: publicationStage,
      status: publicationStage === 'publish' ? evidence.status : 'blocked',
    })
    const context = publicationStage === 'publication-identity'
      ? 'publication identity validation'
      : `publication effect ${publicationStage}`
    throw new Error(`Release blocked during ${context}: ${errorMessage(error)}`, {
      cause: error,
    })
  }

  await recordRegistryHealth({ effects, evidence })

  return evidence
}

export async function runReleaseReconciliation({ request, repositoryRoot, effects }) {
  if (request.mode !== 'reconcile') {
    throw new Error('Publication reconciliation requires a reconcile request')
  }

  const evidence = await effects.readEvidence({
    repositoryRoot,
    targetVersion: request.targetVersion,
  })
  if (evidence?.identity?.targetVersion !== request.targetVersion) {
    throw new Error('Reconciliation evidence does not match the target version')
  }
  if (evidence.status !== 'pushed' && !evidence.timestamps?.pushedAt) {
    throw new Error('Publication reconciliation is only available after push may have succeeded')
  }
  if (evidence.registryHealth !== undefined) return evidence

  const artifact = {
    ...evidence.artifact,
    integritySha512: evidence.identity.artifactIntegritySha512,
  }
  const reconciliationIdentity = {
    phase: 'reconcile',
    repositoryRoot,
    changeHeadCommit: evidence.changeHeadCommit,
    identity: evidence.identity,
    artifact,
    releaseBaseline: evidence.releaseBaseline,
    tagName: `v${request.targetVersion}`,
  }
  try {
    await effects.assertReleaseIdentity(reconciliationIdentity)
  }
  catch (error) {
    await recordBlockedEvidence({
      effects,
      evidence,
      error,
      stage: 'reconciliation-identity',
    })
    throw new Error(`Publication reconciliation identity validation failed: ${errorMessage(error)}`, {
      cause: error,
    })
  }

  let registryRelease
  try {
    registryRelease = await effects.readRegistryRelease({
      packageName: artifact.packageName,
      targetVersion: request.targetVersion,
    })
    const resultIsKnown = registryRelease?.state === 'absent'
      || (registryRelease?.state === 'published'
        && typeof registryRelease.integrity === 'string'
        && registryRelease.integrity.length > 0)
    if (!resultIsKnown) {
      throw new Error('registry query returned an indeterminate result')
    }
  }
  catch (error) {
    await recordBlockedEvidence({
      effects,
      evidence,
      error,
      stage: 'registry-query',
    })
    throw new Error(`Publication reconciliation registry query failed: ${errorMessage(error)}`, {
      cause: error,
    })
  }
  if (registryRelease?.state === 'absent') {
    let stage = 'reconciliation-identity'
    try {
      await effects.assertReleaseIdentity(reconciliationIdentity)
      stage = 'reconciliation-publish'
      await effects.publish({
        archivePath: artifact.archivePath,
        distTag: 'latest',
      })
    }
    catch (error) {
      await recordBlockedEvidence({
        effects,
        evidence,
        error,
        stage,
        status: stage === 'reconciliation-publish' ? evidence.status : 'blocked',
      })
      throw new Error(`Publication ${stage.replace('-', ' ')} failed: ${errorMessage(error)}`, {
        cause: error,
      })
    }
    evidence.status = 'published'
    delete evidence.blocked
    evidence.timestamps.publishedAt = effects.now()
    await effects.writeEvidence(evidence)
    await recordRegistryHealth({ effects, evidence })
    return evidence
  }
  if (registryRelease?.state === 'published'
    && registryRelease.integrity === evidence.identity.artifactIntegritySha512) {
    evidence.status = 'published'
    delete evidence.blocked
    evidence.timestamps.reconciledAt = effects.now()
    await effects.writeEvidence(evidence)
    await recordRegistryHealth({ effects, evidence })
    return evidence
  }
  if (registryRelease?.state === 'published') {
    await recordBlockedEvidence({
      effects,
      evidence,
      error: new Error('Published registry artifact integrity differs from retained tarball'),
      stage: 'registry-integrity-conflict',
    })
    throw new Error('Fatal publication artifact conflict: registry integrity differs')
  }
}

export function runReleaseRegistrySmokeRetry({ request, repositoryRoot, effects }) {
  if (request.mode !== 'registry-smoke-retry') {
    throw new Error('Registry smoke retry requires a registry-smoke-retry request')
  }
  return runRegistrySmokeRetry({
    repositoryRoot,
    targetVersion: request.targetVersion,
    readEvidence: effects.readEvidence,
    writeEvidence: effects.writeEvidence,
    verifyRegistryPackage: effects.verifyRegistryPackage,
    now: effects.now,
  })
}

export async function runReleaseCli({
  argv = process.argv.slice(2),
  effectFactory = createReleaseEffects,
  repositoryRoot = process.cwd(),
} = {}) {
  const request = parseReleaseArguments(argv)
  const effects = effectFactory({
    repositoryRoot,
    targetVersion: request.targetVersion,
  })
  if (request.mode === 'registry-smoke-retry') {
    return runReleaseRegistrySmokeRetry({ request, repositoryRoot, effects })
  }
  if (request.mode === 'reconcile') {
    return runReleaseReconciliation({ request, repositoryRoot, effects })
  }
  return runReleaseGate({ request, repositoryRoot, effects })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runReleaseCli()
    .then((evidence) => {
      process.stdout.write(`Release gate completed with status: ${evidence.status}\n`)
    })
    .catch((error) => {
      process.stderr.write(`${errorMessage(error)}\n`)
      process.exitCode = 1
    })
}
