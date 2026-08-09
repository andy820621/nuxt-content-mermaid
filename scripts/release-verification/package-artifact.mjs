#!/usr/bin/env node
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createReleaseVerificationOperations } from './operations.mjs'
import { selectVersionProfile } from './profiles.mjs'
import {
  ReleaseVerificationFailure,
  runPackageArtifactVerification,
} from './runner.mjs'

const OPTION_NAMES = new Set(['package-source', 'profile'])

export function parseVerificationSelection(argv) {
  const options = new Map()
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected argument: ${argument}`)
    }

    const equalsIndex = argument.indexOf('=')
    const name = argument.slice(2, equalsIndex >= 0 ? equalsIndex : undefined)
    if (!OPTION_NAMES.has(name)) throw new Error(`Unknown option: --${name}`)
    if (options.has(name)) throw new Error(`Duplicate option: --${name}`)

    const value = equalsIndex >= 0
      ? argument.slice(equalsIndex + 1)
      : argv[++index]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${name}`)
    }
    options.set(name, value)
  }

  const packageSource = options.get('package-source') ?? 'pack'
  if (packageSource !== 'pack') {
    throw new Error(`Unsupported package source: ${packageSource}`)
  }

  const profileId = options.get('profile')
  if (!profileId) {
    throw new Error('Choose one Version Profile')
  }

  return {
    packageSource,
    profileId,
  }
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const defaultRepositoryRoot = resolve(scriptDirectory, '../..')

export async function runReleaseVerificationCli({
  argv,
  repositoryRoot = defaultRepositoryRoot,
  operations = createReleaseVerificationOperations({
    templateDirectory: join(
      repositoryRoot,
      'test/release-verification/consumer-template',
    ),
  }),
  runners = {
    single: runPackageArtifactVerification,
  },
  writeEvidence = evidence => console.log(JSON.stringify(evidence, null, 2)),
}) {
  const selection = parseVerificationSelection(argv)
  const profile = selectVersionProfile(selection.profileId)
  const packageSource = {
    kind: selection.packageSource,
    repositoryRoot,
  }
  const evidence = await runners.single({ packageSource, profile }, operations)
  writeEvidence(evidence)
  return evidence
}

async function main() {
  try {
    await runReleaseVerificationCli({ argv: process.argv.slice(2) })
  }
  catch (error) {
    if (error instanceof ReleaseVerificationFailure) {
      console.error(error.message)
      console.error(JSON.stringify(error.evidence, null, 2))
    }
    else {
      console.error(error instanceof Error ? error.message : String(error))
    }
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
