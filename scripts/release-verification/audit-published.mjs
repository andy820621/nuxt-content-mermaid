#!/usr/bin/env node
// Audits only what a consumer installs from the published package: the
// tarball's `dependencies`, resolved fresh from the registry. Peer, dev,
// playground, and website dependencies are out of scope (Dependabot alerts
// cover them). Any scan error fails; it never passes silently.
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const SEVERITIES = ['info', 'low', 'moderate', 'high', 'critical']
const BLOCKING_SEVERITIES = ['high', 'critical']

export function readPublishedDependencies(manifest) {
  const dependencies = manifest?.dependencies
  if (!dependencies || typeof dependencies !== 'object' || Object.keys(dependencies).length === 0) {
    throw new Error('Published manifest has no dependencies to audit')
  }
  return dependencies
}

// `npm audit` exits 1 both for findings at --audit-level and for scan errors,
// so the decision comes from the JSON counts and the exit code must agree.
export function evaluateAuditReport(report, exitCode) {
  if (!report || typeof report !== 'object' || report.error) {
    throw new Error(`npm audit failed: ${report?.message ?? 'no audit report'}`)
  }
  const counts = report.metadata?.vulnerabilities
  if (!SEVERITIES.every(severity => Number.isInteger(counts?.[severity]))) {
    throw new Error('npm audit report is missing severity counts')
  }
  if (!(report.metadata.dependencies?.prod > 0)) {
    throw new Error('npm audit scanned no production dependencies')
  }
  const blocking = BLOCKING_SEVERITIES.reduce((sum, severity) => sum + counts[severity], 0)
  if ((exitCode === 0) !== (blocking === 0)) {
    throw new Error(`npm audit exit code ${exitCode} disagrees with ${blocking} high or critical findings`)
  }
  return { counts, passed: blocking === 0 }
}

function formatFindings(report) {
  return Object.values(report.vulnerabilities ?? {}).map((vulnerability) => {
    const advisories = (vulnerability.via ?? [])
      .map(via => typeof via === 'string' ? `via ${via}` : `${via.title} ${via.url}`)
      .join('; ')
    return `- ${vulnerability.name} (${vulnerability.severity}): ${advisories}`
  })
}

async function readArchiveManifest(archivePath, directory) {
  await execFileAsync('tar', ['-xzf', archivePath, '-C', directory, 'package/package.json'])
  return JSON.parse(await readFile(join(directory, 'package/package.json'), 'utf8'))
}

async function packManifest(repositoryRoot, directory) {
  // Lifecycle scripts only build dist; the manifest is identical without them.
  await execFileAsync('pnpm', ['pack', '--config.ignore-scripts=true', '--pack-destination', directory], {
    cwd: repositoryRoot,
  })
  const tarballs = (await readdir(directory)).filter(filename => filename.endsWith('.tgz'))
  if (tarballs.length !== 1) {
    throw new Error(`pnpm pack must produce exactly one tarball; found ${tarballs.length}`)
  }
  return readArchiveManifest(join(directory, tarballs[0]), directory)
}

export async function auditPublishedDependencies({ archivePath, repositoryRoot }) {
  const workspace = await mkdtemp(join(tmpdir(), 'nuxt-content-mermaid-audit-'))
  // pnpm exposes pnpm-only lifecycle config that nested npm 11 rejects.
  const env = { ...process.env, npm_config_allow_scripts: undefined, npm_config_globalconfig: undefined }
  try {
    const manifest = archivePath
      ? await readArchiveManifest(resolve(archivePath), workspace)
      : await packManifest(repositoryRoot, workspace)
    const dependencies = readPublishedDependencies(manifest)
    console.log(`Auditing ${manifest.name}@${manifest.version} dependencies:`, dependencies)

    const consumer = join(workspace, 'consumer')
    await mkdir(consumer)
    await writeFile(join(consumer, 'package.json'), `${JSON.stringify({ private: true, dependencies }, null, 2)}\n`)
    await execFileAsync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: consumer,
      env,
    })

    let stdout
    let exitCode = 0
    try {
      ({ stdout } = await execFileAsync('npm', ['audit', '--omit=dev', '--audit-level', 'high', '--json'], {
        cwd: consumer,
        env,
        maxBuffer: 10 * 1024 * 1024,
      }))
    }
    catch (error) {
      stdout = error.stdout
      exitCode = typeof error.code === 'number' ? error.code : 1
    }

    let report
    try {
      report = JSON.parse(stdout)
    }
    catch {
      throw new Error('npm audit did not return a JSON report')
    }
    const result = evaluateAuditReport(report, exitCode)
    console.log('Vulnerability counts:', result.counts)
    for (const line of formatFindings(report)) console.log(line)
    return result
  }
  finally {
    await rm(workspace, { recursive: true, force: true })
  }
}

async function main() {
  try {
    const result = await auditPublishedDependencies({
      archivePath: process.argv[2],
      repositoryRoot: resolve(fileURLToPath(import.meta.url), '../../..'),
    })
    if (!result.passed) {
      console.error('Published dependencies have high or critical advisories.')
      process.exitCode = 1
    }
    else {
      console.log('No high or critical advisories in published dependencies.')
    }
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
