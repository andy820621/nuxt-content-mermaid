#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createReleaseVerificationOperations } from './operations.mjs'
import { parseExactSemver } from './exact-semver.mjs'
import { parseVersionProfile } from './profiles.mjs'
import {
  ReleaseVerificationFailure,
  runPackageArtifactVerification,
} from './runner.mjs'

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const OPTION_NAMES = new Set(['request', 'result'])

export function parseReleaseProfileArguments(argv) {
  const options = new Map()
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`)
    const name = argument.slice(2)
    if (!OPTION_NAMES.has(name)) throw new Error(`Unknown option: --${name}`)
    if (options.has(name)) throw new Error(`Duplicate option: --${name}`)
    const value = argv[++index]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}`)
    options.set(name, value)
  }

  const requestPath = options.get('request')
  const resultPath = options.get('result')
  if (!requestPath || !resultPath) {
    throw new Error('Release profile child requires --request and --result')
  }
  if (!isAbsolute(requestPath) || !isAbsolute(resultPath)) {
    throw new Error('Release profile request and result paths must be absolute')
  }
  if (requestPath === resultPath) {
    throw new Error('Release profile request and result must use different files')
  }
  return { requestPath, resultPath }
}

function parseArtifact(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Release profile request requires retained artifact identity')
  }
  if (typeof input.archivePath !== 'string' || !isAbsolute(input.archivePath)) {
    throw new TypeError('Retained artifact archivePath must be absolute')
  }
  for (const field of ['filename', 'packageName']) {
    if (typeof input[field] !== 'string' || !input[field]) {
      throw new TypeError(`Retained artifact ${field} must be a non-empty string`)
    }
  }
  if (!parseExactSemver(input.packageVersion)) {
    throw new TypeError('Retained artifact packageVersion must be an exact version')
  }
  if (typeof input.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(input.sha256)) {
    throw new TypeError('Retained artifact sha256 must be a lowercase SHA-256 digest')
  }
  if (typeof input.integritySha512 !== 'string'
    || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(input.integritySha512)) {
    throw new TypeError('Retained artifact integritySha512 must be npm SHA-512 integrity')
  }
  if (!Array.isArray(input.packlist)
    || input.packlist.some(path => typeof path !== 'string' || !path)) {
    throw new TypeError('Retained artifact packlist must contain non-empty paths')
  }
  return Object.freeze({
    archivePath: input.archivePath,
    filename: input.filename,
    sha256: input.sha256,
    integritySha512: input.integritySha512,
    packlist: Object.freeze([...input.packlist]),
    packageName: input.packageName,
    packageVersion: input.packageVersion,
  })
}

async function readRequest(requestPath) {
  const request = JSON.parse(await readFile(requestPath, 'utf8'))
  if (request?.schemaVersion !== 1) {
    throw new TypeError('Unsupported release profile request schema')
  }
  const artifact = parseArtifact(request.artifact)
  const archiveBytes = await readFile(artifact.archivePath)
  const sha256 = createHash('sha256').update(archiveBytes).digest('hex')
  if (sha256 !== artifact.sha256) {
    throw new Error('Retained artifact bytes do not match the frozen SHA-256 identity')
  }
  const integritySha512 = `sha512-${createHash('sha512').update(archiveBytes).digest('base64')}`
  if (integritySha512 !== artifact.integritySha512) {
    throw new Error('Retained artifact bytes do not match the frozen SHA-512 identity')
  }
  return {
    artifact,
    profile: parseVersionProfile(request.profile),
  }
}

async function writeResult(resultPath, evidence) {
  const temporaryPath = `${resultPath}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(evidence, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    })
    await rename(temporaryPath, resultPath)
  }
  finally {
    await rm(temporaryPath, { force: true })
  }
}

export async function runReleaseProfileChild({
  requestPath,
  resultPath,
  verifier = runPackageArtifactVerification,
  operations,
}) {
  const request = await readRequest(requestPath)
  const verificationOperations = operations ?? createReleaseVerificationOperations({
    templateDirectory: join(
      MODULE_DIRECTORY,
      '../../test/release-verification/consumer-template',
    ),
  })
  try {
    const evidence = await verifier({
      packageSource: { kind: 'retained', artifact: request.artifact },
      profile: request.profile,
    }, verificationOperations)
    await writeResult(resultPath, evidence)
    return evidence
  }
  catch (error) {
    if (error instanceof ReleaseVerificationFailure) {
      await writeResult(resultPath, error.evidence)
    }
    throw error
  }
}

export function runReleaseProfileCli({ argv = process.argv.slice(2) } = {}) {
  return runReleaseProfileChild(parseReleaseProfileArguments(argv))
}

async function main() {
  try {
    await runReleaseProfileCli()
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
