#!/usr/bin/env node
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createReleaseVerificationOperations } from './operations.mjs'
import { selectVersionProfile } from './profiles.mjs'
import {
  ReleaseVerificationFailure,
  runPackageArtifactVerification,
} from './runner.mjs'

function optionValue(name, fallback) {
  const prefixed = `--${name}=`
  const inline = process.argv.find(argument => argument.startsWith(prefixed))
  if (inline) return inline.slice(prefixed.length)
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '../..')
const packageSource = optionValue('package-source', 'pack')
const profileId = optionValue('profile', 'nuxt-4-known-latest')

try {
  const profile = selectVersionProfile(profileId)
  const operations = createReleaseVerificationOperations({
    templateDirectory: join(
      repositoryRoot,
      'test/release-verification/consumer-template',
    ),
  })
  const evidence = await runPackageArtifactVerification({
    packageSource: {
      kind: packageSource,
      repositoryRoot,
    },
    profile,
  }, operations)
  console.log(JSON.stringify(evidence, null, 2))
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
