#!/usr/bin/env node
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseStableSemver } from './exact-semver.mjs'
import { runCommand as runProcess } from './operations.mjs'

const ALLOWED_CHANGED_PATHS = new Set([
  'CHANGELOG.md',
  'package.json',
  'pnpm-lock.yaml',
])

export function parsePrepareReleasePrArguments(argv) {
  if (argv.length !== 1) {
    throw new Error('Release PR preparation requires one stable exact version')
  }
  const [targetVersion] = argv
  if (!parseStableSemver(targetVersion)) {
    throw new Error('Release PR preparation requires a stable exact version')
  }
  return { targetVersion }
}

function pathsFromPorcelain(output) {
  const records = output.split('\0').filter(Boolean)
  const paths = []
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    const status = record.slice(0, 2)
    paths.push(record.slice(3))
    if (/[RC]/.test(status) && records[index + 1]) {
      paths.push(records[++index])
    }
  }
  return paths
}

async function listChangedPaths(repositoryRoot) {
  const result = await runProcess({
    command: 'git',
    args: ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
    cwd: repositoryRoot,
  })
  return pathsFromPorcelain(result.stdout ?? '')
}

export async function runPrepareReleasePr({
  argv,
  repositoryRoot,
  effects = {},
}) {
  const request = parsePrepareReleasePrArguments(argv)
  const getChangedPaths = effects.listChangedPaths ?? (() => listChangedPaths(repositoryRoot))
  const runCommand = effects.runCommand ?? runProcess
  const baselinePaths = await getChangedPaths()
  if (baselinePaths.length > 0) {
    throw new Error(`Release PR preparation requires a clean baseline; found: ${baselinePaths.join(', ')}`)
  }

  await runCommand({
    command: 'pnpm',
    args: [
      'changelogen',
      '--release',
      '-r',
      request.targetVersion,
      '--no-commit',
      '--no-tag',
      '--no-github',
    ],
    cwd: repositoryRoot,
  })
  await runCommand({
    command: 'pnpm',
    args: ['install', '--lockfile-only', '--ignore-scripts'],
    cwd: repositoryRoot,
  })

  const changedPaths = await getChangedPaths()
  const unexpectedPath = changedPaths.find(path => !ALLOWED_CHANGED_PATHS.has(path))
  if (unexpectedPath) {
    throw new Error(`Release PR preparation changed an unexpected path: ${unexpectedPath}`)
  }
  return {
    targetVersion: request.targetVersion,
    changedPaths: changedPaths.toSorted(),
  }
}

async function main() {
  try {
    const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))
    const result = await runPrepareReleasePr({
      argv: process.argv.slice(2),
      repositoryRoot,
    })
    console.log(`Prepared Release PR metadata for ${result.targetVersion}`)
    console.log(`Changed paths: ${result.changedPaths.join(', ') || '(none)'}`)
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
