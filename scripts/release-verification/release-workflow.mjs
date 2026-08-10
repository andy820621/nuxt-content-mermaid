#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compareStableSemver, parseStableSemver } from './exact-semver.mjs'
import {
  createReleaseVerificationOperations,
  formatArtifactChecksum,
  runCommand,
} from './operations.mjs'
import { selectVersionProfile } from './profiles.mjs'
import { runRegistrySmokeVerification } from './runner.mjs'

const PACKAGE_NAME = '@barzhsieh/nuxt-content-mermaid'

export const RELEASE_IMPACT_DIMENSIONS = Object.freeze([
  'package contents',
  'runtime behavior',
  'interaction',
  'styling/layout',
  'browser APIs',
  'runtime dependencies',
])

const MANUAL_DIMENSIONS = new Set([
  'interaction',
  'styling/layout',
  'browser APIs',
])
const IMPACT_VALUES = new Set(['affected', 'unaffected', 'uncertain'])

function cleanCell(value) {
  return value.trim().replace(/^`|`$/g, '').trim()
}

function canonicalDimension(value) {
  const normalized = cleanCell(value).toLowerCase()
  const aliases = {
    'package contents': 'package contents',
    'runtime behavior': 'runtime behavior',
    'interaction': 'interaction',
    'styling': 'styling/layout',
    'styling/layout': 'styling/layout',
    'browser api': 'browser APIs',
    'browser apis': 'browser APIs',
    'runtime dependencies': 'runtime dependencies',
  }
  return aliases[normalized] ?? null
}

function hasEvidence(value) {
  const normalized = cleanCell(value)
  return normalized.length > 0
    && !normalized.includes('<!--')
    && !/^(?:n\/?a|todo|tbd|none|\.\.\.)$/i.test(normalized)
}

function parseTargetVersion(body) {
  const marker = /<!--\s*release-pr-target\s*-->/i.exec(body)
  if (!marker) return null
  const target = /Target version:\s*`([^`]+)`/i.exec(body.slice(marker.index))
  return target && parseStableSemver(target[1]) ? target[1] : null
}

function parseImpactDeclaration(body) {
  const dimensions = new Map()
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue
    const cells = line.split('|').slice(1, -1).map(cleanCell)
    if (cells.length < 3) continue
    const dimension = canonicalDimension(cells[0])
    if (!dimension) continue
    dimensions.set(dimension, {
      impact: cells[1].toLowerCase(),
      evidence: cells.slice(2).join(' | ').trim(),
    })
  }

  for (const dimension of RELEASE_IMPACT_DIMENSIONS) {
    const declaration = dimensions.get(dimension)
    if (!declaration) {
      throw new Error(`Release Impact Declaration is missing dimension: ${dimension}`)
    }
    if (!IMPACT_VALUES.has(declaration.impact)) {
      throw new Error(`Release Impact Declaration has invalid impact for ${dimension}`)
    }
    if (!hasEvidence(declaration.evidence)) {
      throw new Error(`Release Impact Declaration is missing evidence: ${dimension}`)
    }
  }
  return Object.fromEntries(dimensions)
}

function parseManualVerification(body) {
  const lines = body.split(/\r?\n/)
  const start = lines.findIndex(line => /^### Manual Interaction Verification\s*$/i.test(line))
  const tail = start < 0 ? [] : lines.slice(start + 1)
  const end = tail.findIndex(line => /^#{1,3}\s/.test(line))
  const section = end < 0 ? tail : tail.slice(0, end)
  const values = {}
  for (const line of section) {
    const item = line.trim()
    const separator = item.indexOf(':')
    if (!item.startsWith('- ') || separator < 0) continue
    const label = item.slice(2, separator).trim().toLowerCase().replace(' ', '')
    if (['required', 'testcommit', 'environment', 'scenarios', 'result'].includes(label)) {
      values[label] = item.slice(separator + 1).trim()
    }
  }
  return values
}

export function validateReleasePullRequest({ body = '', baseVersion, headVersion }) {
  const targetVersion = parseTargetVersion(body)
  const versionChanged = baseVersion !== headVersion
  if (!targetVersion && !versionChanged) return { isReleasePullRequest: false }
  if (!targetVersion) {
    throw new Error('Release PR package version change requires a valid target marker')
  }
  if (targetVersion !== headVersion) {
    throw new Error(`Release PR target ${targetVersion} does not match package version ${headVersion}`)
  }

  const impactDeclaration = parseImpactDeclaration(body)
  const manualRequired = [...MANUAL_DIMENSIONS].some((dimension) => {
    const impact = impactDeclaration[dimension].impact
    return impact === 'affected' || impact === 'uncertain'
  })
  const manual = parseManualVerification(body)
  if (manualRequired) {
    if (manual.required?.toLowerCase() !== 'yes'
      || !['testcommit', 'environment', 'scenarios', 'result'].every(
        field => hasEvidence(manual[field] ?? ''),
      )) {
      throw new Error('Manual Interaction Verification is required with test commit, environment, scenarios, and result evidence')
    }
  }
  else if (manual.required?.toLowerCase() !== 'no') {
    throw new Error('Manual Interaction Verification must record Required: no when it is not triggered')
  }

  return {
    isReleasePullRequest: true,
    targetVersion,
    impactDeclaration,
    manualInteractionVerificationRequired: manualRequired,
  }
}

function assertStableVersion(version, label = 'Release target') {
  if (!parseStableSemver(version)) {
    throw new Error(`${label} must be a stable exact version`)
  }
}

function validatedNpmState(state) {
  assertStableVersion(state?.latestVersion, 'npm latest')
  if (state?.exact?.state === 'absent') return state
  if (state?.exact?.state === 'published'
    && typeof state.exact.integrity === 'string'
    && /^sha512-[A-Za-z0-9+/]+={0,2}$/.test(state.exact.integrity)) {
    return state
  }
  throw new Error('npm registry returned an indeterminate exact-version state')
}

function assertMatchingArtifact(artifact, targetVersion) {
  if (!artifact
    || artifact.packageName !== PACKAGE_NAME
    || artifact.packageVersion !== targetVersion
    || !isAbsolute(artifact.archivePath)) {
    throw new Error(`Verified artifact does not match ${PACKAGE_NAME}@${targetVersion}`)
  }
}

function assertTagAndReleaseState({ tag, release, sourceCommit, tagName }) {
  if (tag?.state !== 'absent' && tag?.state !== 'present') {
    throw new Error('Git tag query returned an indeterminate state')
  }
  if (release?.state !== 'absent' && release?.state !== 'present') {
    throw new Error('GitHub Release query returned an indeterminate state')
  }
  if (tag.state === 'present'
    && (tag.annotated !== true || tag.targetSha !== sourceCommit)) {
    throw new Error('Existing tag is not an annotated tag for the release source commit')
  }
  if (release.state === 'present' && release.tagName !== tagName) {
    throw new Error('Existing GitHub Release targets a different tag')
  }
  if (release.state === 'present' && tag.state === 'absent') {
    throw new Error('GitHub Release exists without its annotated tag')
  }
}

export function extractChangelogSection(changelog, targetVersion) {
  assertStableVersion(targetVersion)
  const lines = changelog.split(/\r?\n/)
  const heading = `## v${targetVersion}`
  const start = lines.findIndex(line => line.trim() === heading)
  if (start < 0) {
    throw new Error(`CHANGELOG does not contain ${heading}`)
  }
  const next = lines.findIndex((line, index) => index > start && /^##\s/.test(line))
  const section = lines.slice(start, next < 0 ? undefined : next).join('\n').trim()
  if (section === heading) {
    throw new Error(`${heading} does not contain release notes`)
  }
  return section
}

export async function runPreflight({ request, effects }) {
  if (request.eventName !== 'workflow_dispatch') {
    throw new Error('Publish preflight requires workflow_dispatch')
  }
  if (request.ref !== 'refs/heads/main') {
    throw new Error('Publish preflight requires refs/heads/main')
  }
  assertStableVersion(request.targetVersion)

  const [localHead, mainHead, manifest] = await Promise.all([
    effects.readLocalHead(),
    effects.readMainHead(),
    effects.readPackageManifest(),
  ])
  if (localHead !== request.sourceCommit) {
    throw new Error('Publish preflight checked-out HEAD does not equal github.sha')
  }
  if (mainHead !== request.sourceCommit) {
    throw new Error('Publish preflight github.sha is not the current main HEAD')
  }
  if (manifest.name !== PACKAGE_NAME || manifest.version !== request.targetVersion) {
    throw new Error('Publish preflight package version or name does not match the target')
  }

  const npmState = validatedNpmState(await effects.readNpmState({
    packageName: PACKAGE_NAME,
    targetVersion: request.targetVersion,
  }))
  const latestComparison = compareStableSemver(request.targetVersion, npmState.latestVersion)
  if (latestComparison < 0
    || (latestComparison === 0 && npmState.exact.state === 'absent')) {
    throw new Error('A fresh release target must be strictly greater than npm latest')
  }

  const pullRequest = await effects.readMergedReleasePullRequest({
    sourceCommit: request.sourceCommit,
  })
  if (pullRequest?.state !== 'merged'
    || pullRequest.baseRef !== 'main'
    || pullRequest.mergeCommitSha !== request.sourceCommit) {
    throw new Error('github.sha does not correspond to a merged Release PR on main')
  }
  validateReleasePullRequest({
    body: pullRequest.body,
    baseVersion: request.targetVersion,
    headVersion: request.targetVersion,
  })
  extractChangelogSection(await effects.readChangelog(), request.targetVersion)

  const tagName = `v${request.targetVersion}`
  const [tag, release] = await Promise.all([
    effects.readTagState({ tagName }),
    effects.readGitHubRelease({ tagName }),
  ])
  assertTagAndReleaseState({
    tag,
    release,
    sourceCommit: request.sourceCommit,
    tagName,
  })
  if (npmState.exact.state === 'absent'
    && (tag.state !== 'absent' || release.state !== 'absent')) {
    throw new Error('A fresh release must not have an existing tag or GitHub Release')
  }

  return {
    mode: npmState.exact.state === 'absent' ? 'fresh' : 'reconciliation',
    sourceCommit: request.sourceCommit,
    targetVersion: request.targetVersion,
  }
}

export async function runNpmPublish({ request, effects, maxAttempts = 6 }) {
  assertStableVersion(request.targetVersion)
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('npm post-check requires at least one attempt')
  }
  const artifact = await effects.loadArtifact({
    archivePath: request.archivePath,
    checksumPath: request.checksumPath,
  })
  assertMatchingArtifact(artifact, request.targetVersion)

  const initial = validatedNpmState(await effects.readNpmState({
    packageName: PACKAGE_NAME,
    targetVersion: request.targetVersion,
  }))
  let action
  let publishError
  if (initial.exact.state === 'published') {
    if (initial.exact.integrity !== artifact.integritySha512) {
      throw new Error('npm exact version has a different artifact integrity')
    }
    action = 'skipped'
  }
  else {
    action = 'published'
    try {
      await effects.publishArtifact({ archivePath: artifact.archivePath })
    }
    catch (error) {
      publishError = error
    }
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const observed = validatedNpmState(await effects.readNpmState({
      packageName: PACKAGE_NAME,
      targetVersion: request.targetVersion,
    }))
    if (observed.exact.state === 'published'
      && observed.exact.integrity !== artifact.integritySha512) {
      throw new Error('npm exact version has a different artifact integrity')
    }
    if (compareStableSemver(observed.latestVersion, request.targetVersion) > 0) {
      throw new Error('npm latest advanced beyond the release target')
    }
    if (observed.exact.state === 'published'
      && observed.exact.integrity === artifact.integritySha512
      && observed.latestVersion === request.targetVersion) {
      return { action, artifact }
    }
    if (attempt < maxAttempts) await effects.wait?.(attempt)
  }
  throw new Error('npm publication post-check did not converge', {
    ...(publishError ? { cause: publishError } : {}),
  })
}

export async function runRegistrySmoke({ request, effects }) {
  assertStableVersion(request.targetVersion)
  const npmState = validatedNpmState(await effects.readNpmState({
    packageName: PACKAGE_NAME,
    targetVersion: request.targetVersion,
  }))
  if (npmState.exact.state !== 'published'
    || npmState.exact.integrity !== request.integritySha512
    || npmState.latestVersion !== request.targetVersion) {
    throw new Error('Registry Smoke requires matching npm exact integrity and latest')
  }
  const evidence = await effects.verifyRegistryPackage({
    packageName: PACKAGE_NAME,
    packageVersion: request.targetVersion,
    profile: selectVersionProfile('v3-known-latest'),
  })
  if (evidence?.success !== true) {
    throw new Error('Registry Smoke did not return successful verification evidence')
  }
  return evidence
}

export async function runFinalize({ request, effects }) {
  assertStableVersion(request.targetVersion)
  if (typeof request.sourceCommit !== 'string' || request.sourceCommit.length === 0) {
    throw new Error('Release finalization requires github.sha')
  }
  const tagName = `v${request.targetVersion}`
  const [tag, release] = await Promise.all([
    effects.readTagState({ tagName }),
    effects.readGitHubRelease({ tagName }),
  ])
  assertTagAndReleaseState({
    tag,
    release,
    sourceCommit: request.sourceCommit,
    tagName,
  })

  if (release.state === 'present') {
    return { tag: 'existing', release: 'existing' }
  }
  const body = extractChangelogSection(
    await effects.readChangelog(),
    request.targetVersion,
  )
  if (tag.state === 'absent') {
    await effects.createAnnotatedTag({
      tagName,
      sourceCommit: request.sourceCommit,
      message: tagName,
    })
  }
  await effects.createGitHubRelease({
    tagName,
    sourceCommit: request.sourceCommit,
    body,
  })
  return {
    tag: tag.state === 'absent' ? 'created' : 'existing',
    release: 'created',
  }
}

export async function runPack({ request, effects }) {
  assertStableVersion(request.targetVersion)
  if (!isAbsolute(request.artifactDirectory)) {
    throw new Error('Release artifact directory must be absolute')
  }
  const manifest = await effects.readPackageManifest()
  if (manifest.name !== PACKAGE_NAME || manifest.version !== request.targetVersion) {
    throw new Error('Release pack package identity does not match the target')
  }
  await effects.ensureEmptyDirectory(request.artifactDirectory)
  const packedArtifact = await effects.createArtifact({
    repositoryRoot: request.repositoryRoot,
    artifactDirectory: request.artifactDirectory,
  })
  assertMatchingArtifact(packedArtifact, request.targetVersion)
  const checksumPath = join(request.artifactDirectory, 'artifact.sha512')
  await effects.writeFile(checksumPath, formatArtifactChecksum(packedArtifact))
  const artifact = await effects.loadArtifact({
    archivePath: packedArtifact.archivePath,
    checksumPath,
  })
  for (const field of [
    'filename',
    'sha256',
    'integritySha512',
    'packageName',
    'packageVersion',
  ]) {
    if (artifact[field] !== packedArtifact[field]) {
      throw new Error(`Packed artifact identity changed while loading ${field}`)
    }
  }
  if (!artifact.packageContract) {
    throw new TypeError('Packed artifact is missing its shallow version contract')
  }
  return {
    artifact,
    checksumPath,
    packageContract: artifact.packageContract,
    profiles: [selectVersionProfile('v3-minimum'), selectVersionProfile('v3-known-latest')],
  }
}

function parseRemoteRefs(output) {
  return new Map(String(output ?? '')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf('\t')
      if (separator < 1) throw new Error('Git remote returned an indeterminate ref')
      return [line.slice(separator + 1), line.slice(0, separator)]
    }))
}

async function responseJson(response, label) {
  try {
    return await response.json()
  }
  catch (error) {
    throw new Error(`${label} returned invalid JSON`, { cause: error })
  }
}

export function createReleaseWorkflowEffects({
  repositoryRoot,
  commandRunner = runCommand,
  fetcher = globalThis.fetch,
  environment = process.env,
} = {}) {
  const verificationOperations = createReleaseVerificationOperations({
    templateDirectory: join(repositoryRoot, 'test/release-verification/consumer-template'),
    commandRunner,
  })

  async function githubRequest(path, options = {}) {
    if (!environment.GITHUB_REPOSITORY || !environment.GITHUB_TOKEN) {
      throw new Error('GitHub API effects require GITHUB_REPOSITORY and GITHUB_TOKEN')
    }
    const response = await fetcher(
      `https://api.github.com/repos/${environment.GITHUB_REPOSITORY}${path}`,
      {
        ...options,
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${environment.GITHUB_TOKEN}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...options.headers,
        },
      },
    )
    return response
  }

  async function readPackageVersionAtRevision(revision) {
    const result = await commandRunner({
      command: 'git',
      args: ['show', `${revision}:package.json`],
      cwd: repositoryRoot,
    })
    const manifest = JSON.parse(result?.stdout ?? '')
    if (!parseStableSemver(manifest.version)) {
      throw new Error(`Revision ${revision} has an invalid package version`)
    }
    return manifest.version
  }

  return {
    readFile,
    readPackageVersionAt: readPackageVersionAtRevision,
    async readLocalHead() {
      const result = await commandRunner({
        command: 'git',
        args: ['rev-parse', 'HEAD'],
        cwd: repositoryRoot,
      })
      return String(result?.stdout ?? '').trim()
    },
    async readMainHead() {
      const result = await commandRunner({
        command: 'git',
        args: ['ls-remote', 'origin', 'refs/heads/main'],
        cwd: repositoryRoot,
      })
      const head = parseRemoteRefs(result?.stdout).get('refs/heads/main')
      if (!head) throw new Error('Remote main HEAD is indeterminate')
      return head
    },
    async readPackageManifest() {
      return JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
    },
    async readChangelog() {
      return readFile(join(repositoryRoot, 'CHANGELOG.md'), 'utf8')
    },
    async readNpmState({ packageName, targetVersion }) {
      const packagePath = encodeURIComponent(packageName)
      const [exactResponse, latestResponse] = await Promise.all([
        fetcher(
          `https://registry.npmjs.org/${packagePath}/${encodeURIComponent(targetVersion)}`,
          { headers: { Accept: 'application/json' } },
        ),
        fetcher(
          `https://registry.npmjs.org/${packagePath}/latest`,
          { headers: { Accept: 'application/json' } },
        ),
      ])
      if (exactResponse.status !== 404 && !exactResponse.ok) {
        throw new Error(`npm registry exact-version query failed with HTTP ${exactResponse.status}`)
      }
      if (!latestResponse.ok) {
        throw new Error(`npm registry latest query failed with HTTP ${latestResponse.status}`)
      }
      const latest = await responseJson(latestResponse, 'npm registry latest')
      const latestVersion = latest?.version
      if (exactResponse.status === 404) {
        return { exact: { state: 'absent' }, latestVersion }
      }
      const release = await responseJson(exactResponse, 'npm registry exact version')
      const integrity = release?.dist?.integrity
      if (typeof integrity !== 'string' || integrity.length === 0) {
        throw new Error('npm registry exact version is missing dist.integrity')
      }
      return {
        exact: { state: 'published', integrity },
        latestVersion,
      }
    },
    async readTagState({ tagName }) {
      const result = await commandRunner({
        command: 'git',
        args: [
          'ls-remote',
          'origin',
          `refs/tags/${tagName}`,
          `refs/tags/${tagName}^{}`,
        ],
        cwd: repositoryRoot,
      })
      const refs = parseRemoteRefs(result?.stdout)
      const direct = refs.get(`refs/tags/${tagName}`)
      const peeled = refs.get(`refs/tags/${tagName}^{}`)
      if (!direct && !peeled) return { state: 'absent' }
      if (!direct) throw new Error('Remote tag state is indeterminate')
      return {
        state: 'present',
        annotated: Boolean(peeled),
        targetSha: peeled ?? direct,
      }
    },
    async readGitHubRelease({ tagName }) {
      const response = await githubRequest(`/releases/tags/${encodeURIComponent(tagName)}`)
      if (response.status === 404) return { state: 'absent' }
      if (!response.ok) {
        throw new Error(`GitHub Release query failed with HTTP ${response.status}`)
      }
      const release = await responseJson(response, 'GitHub Release')
      if (typeof release.tag_name !== 'string') {
        throw new TypeError('GitHub Release query returned an indeterminate state')
      }
      return { state: 'present', tagName: release.tag_name }
    },
    async readMergedReleasePullRequest({ sourceCommit }) {
      const response = await githubRequest(`/commits/${encodeURIComponent(sourceCommit)}/pulls`)
      if (!response.ok) {
        throw new Error(`GitHub pull request query failed with HTTP ${response.status}`)
      }
      const pullRequests = await responseJson(response, 'GitHub pull request query')
      if (!Array.isArray(pullRequests)) {
        throw new TypeError('GitHub pull request query returned an indeterminate state')
      }
      const matches = pullRequests.filter(pullRequest => (
        pullRequest?.merged_at
        && pullRequest?.base?.ref === 'main'
        && pullRequest?.merge_commit_sha === sourceCommit
      ))
      if (matches.length !== 1) return { state: 'absent' }
      return {
        state: 'merged',
        baseRef: matches[0].base.ref,
        mergeCommitSha: matches[0].merge_commit_sha,
        body: matches[0].body ?? '',
      }
    },
    loadArtifact: input => verificationOperations.loadArtifact(input),
    createArtifact: input => verificationOperations.createArtifact(input),
    async ensureEmptyDirectory(directory) {
      await mkdir(directory, { recursive: true })
      if ((await readdir(directory)).length > 0) {
        throw new Error('Release artifact directory contains pre-existing state')
      }
    },
    writeFile,
    async publishArtifact({ archivePath }) {
      if (!isAbsolute(archivePath)) {
        throw new Error('npm publish requires an absolute verified tarball path')
      }
      await commandRunner({
        command: 'npm',
        args: [
          'publish',
          archivePath,
          '--access',
          'public',
          '--tag',
          'latest',
          '--ignore-scripts',
        ],
        cwd: repositoryRoot,
      })
    },
    wait(attempt) {
      return new Promise(resolveWait => setTimeout(resolveWait, Math.min(2 ** attempt * 1000, 8000)))
    },
    verifyRegistryPackage(request) {
      return runRegistrySmokeVerification(request, verificationOperations)
    },
    async createAnnotatedTag({ tagName, sourceCommit, message }) {
      await commandRunner({
        command: 'git',
        args: [
          '-c',
          'user.name=github-actions[bot]',
          '-c',
          'user.email=41898282+github-actions[bot]@users.noreply.github.com',
          'tag',
          '-a',
          tagName,
          sourceCommit,
          '-m',
          message,
        ],
        cwd: repositoryRoot,
      })
      await commandRunner({
        command: 'git',
        args: ['push', 'origin', `refs/tags/${tagName}`],
        cwd: repositoryRoot,
      })
    },
    async createGitHubRelease({ tagName, sourceCommit, body }) {
      const response = await githubRequest('/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_name: tagName,
          target_commitish: sourceCommit,
          name: tagName,
          body,
          draft: false,
          prerelease: false,
        }),
      })
      if (!response.ok) {
        throw new Error(`GitHub Release creation failed with HTTP ${response.status}`)
      }
    },
  }
}

const COMMAND_OPTIONS = Object.freeze({
  'validate-pr': ['event-path'],
  'preflight': ['version'],
  'pack': ['artifact-directory', 'version'],
  'publish': ['archive', 'checksum', 'version'],
  'registry-smoke': ['integrity', 'version'],
  'finalize': ['sha', 'version'],
})

export function parseReleaseWorkflowArguments(argv) {
  const [command, ...args] = argv
  const allowed = COMMAND_OPTIONS[command]
  if (!allowed) throw new Error(`Unknown release workflow command: ${command ?? '<missing>'}`)
  const options = {}
  for (let index = 0; index < args.length; index += 2) {
    const argument = args[index]
    if (!argument?.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`)
    const name = argument.slice(2)
    if (!allowed.includes(name)) throw new Error(`Unknown ${command} option: --${name}`)
    if (Object.hasOwn(options, name)) throw new Error(`Duplicate ${command} option: --${name}`)
    const value = args[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}`)
    options[name] = value
  }
  const missing = allowed.find(name => !options[name])
  if (missing) throw new Error(`${command} requires --${missing}`)
  if (options.version) assertStableVersion(options.version)
  for (const pathOption of ['archive', 'artifact-directory', 'checksum']) {
    if (options[pathOption] && !isAbsolute(options[pathOption])) {
      throw new Error(`--${pathOption} must be an absolute path`)
    }
  }
  return { command, ...options }
}

export async function runReleaseWorkflowCli({
  argv,
  repositoryRoot,
  effects,
  environment = process.env,
}) {
  const request = parseReleaseWorkflowArguments(argv)
  const runtimeEffects = effects ?? createReleaseWorkflowEffects({ repositoryRoot, environment })
  let result
  if (request.command === 'validate-pr') {
    const event = JSON.parse(await runtimeEffects.readFile(resolve(request['event-path']), 'utf8'))
    if (event.action == null || !event.pull_request) {
      throw new Error('Release PR validation requires a pull_request event payload')
    }
    result = validateReleasePullRequest({
      body: event.pull_request.body ?? '',
      baseVersion: await runtimeEffects.readPackageVersionAt(event.pull_request.base.sha),
      headVersion: await runtimeEffects.readPackageVersionAt(event.pull_request.head.sha),
    })
    console.log(result.isReleasePullRequest
      ? `Validated Release PR for ${result.targetVersion}`
      : 'Ordinary PR: Release PR validation not required')
    return result
  }
  if (request.command === 'preflight') {
    result = await runPreflight({
      request: {
        eventName: environment.GITHUB_EVENT_NAME,
        ref: environment.GITHUB_REF,
        sourceCommit: environment.GITHUB_SHA,
        targetVersion: request.version,
      },
      effects: runtimeEffects,
    })
  }
  else if (request.command === 'pack') {
    result = await runPack({
      request: {
        targetVersion: request.version,
        repositoryRoot,
        artifactDirectory: request['artifact-directory'],
      },
      effects: runtimeEffects,
    })
  }
  else if (request.command === 'publish') {
    result = await runNpmPublish({
      request: {
        targetVersion: request.version,
        archivePath: request.archive,
        checksumPath: request.checksum,
      },
      effects: runtimeEffects,
    })
  }
  else if (request.command === 'registry-smoke') {
    result = await runRegistrySmoke({
      request: {
        targetVersion: request.version,
        integritySha512: request.integrity,
      },
      effects: runtimeEffects,
    })
  }
  else {
    result = await runFinalize({
      request: {
        targetVersion: request.version,
        sourceCommit: request.sha,
      },
      effects: runtimeEffects,
    })
  }
  console.log(JSON.stringify(result, null, 2))
  return result
}

async function main() {
  try {
    await runReleaseWorkflowCli({
      argv: process.argv.slice(2),
      repositoryRoot: resolve(fileURLToPath(new URL('../..', import.meta.url))),
    })
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
