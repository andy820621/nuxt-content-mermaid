import { readFile, realpath } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadNuxtConfig } from '@nuxt/kit'
import { parse } from 'yaml'

const PACKAGE_NAME = '@barzhsieh/nuxt-content-mermaid'
const EXPECTED_VERSION = '3.0.0'

export class WebsiteArtifactIntegrationFailure extends Error {
  constructor(message) {
    super(`website artifact-integration failure: ${message}`)
    this.name = 'WebsiteArtifactIntegrationFailure'
  }
}

export class WebsiteVerificationInfrastructureFailure extends Error {
  constructor(message, options) {
    super(`website verification infrastructure failure: ${message}`, options)
    this.name = 'WebsiteVerificationInfrastructureFailure'
  }
}

function fail(message) {
  throw new WebsiteArtifactIntegrationFailure(message)
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) fail(`${label} mismatch: expected ${expected}, received ${actual}`)
}

function isWithin(parent, candidate) {
  const child = relative(parent, candidate)
  return child === '' || (!child.startsWith('..') && !child.startsWith(sep))
}

export function validateWebsiteArtifactIdentity(identity) {
  const {
    repositoryRoot,
    packageName,
    expectedVersion,
    websiteSpecifier,
    workspace,
    lockfile,
    registry,
    installed,
    nuxtModules,
    disclosure,
  } = identity

  assertEqual('website package specifier', websiteSpecifier, expectedVersion)
  assertEqual('workspace link preference', workspace?.linkWorkspacePackages, false)
  assertEqual('workspace version preference', workspace?.preferWorkspacePackages, false)
  assertEqual('lockfile specifier', lockfile?.specifier, expectedVersion)
  assertEqual('lockfile version', lockfile?.version, expectedVersion)
  assertEqual('registry package name', registry?.name, packageName)
  assertEqual('registry package version', registry?.version, expectedVersion)
  assertEqual('registry integrity', registry?.dist?.integrity, lockfile?.integrity)

  const expectedTarball = `https://registry.npmjs.org/${packageName}/-/nuxt-content-mermaid-${expectedVersion}.tgz`
  assertEqual('registry tarball', registry?.dist?.tarball, expectedTarball)
  assertEqual('installed package name', installed?.manifestName, packageName)
  assertEqual('installed package version', installed?.manifestVersion, expectedVersion)
  assertEqual('homepage artifact disclosure', disclosure, expectedVersion)

  if (!Array.isArray(nuxtModules) || !nuxtModules.includes(packageName)) {
    fail(`Nuxt modules must register ${packageName} by its public package identifier`)
  }

  const repository = resolve(repositoryRoot)
  const manifestPath = resolve(installed?.manifestPath ?? '')
  const moduleEntryPath = resolve(installed?.moduleEntryPath ?? '')
  const packageRoot = dirname(manifestPath)
  const pnpmStore = resolve(repository, 'node_modules/.pnpm')
  if (!isWithin(pnpmStore, manifestPath)
    || !manifestPath.includes(`${sep}node_modules${sep}.pnpm${sep}`)) {
    fail('installed package must resolve to a registry .pnpm installation')
  }
  if (!isWithin(packageRoot, moduleEntryPath)) {
    fail('installed manifest and module entry must resolve from the same package')
  }

  return {
    phase: 'artifact-integration',
    packageName,
    version: expectedVersion,
    integrity: lockfile.integrity,
    tarball: registry.dist.tarball,
    manifestPath,
    moduleEntryPath,
  }
}

async function defaultFetchRegistryMetadata() {
  let response
  try {
    response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(PACKAGE_NAME)}/${EXPECTED_VERSION}`)
  }
  catch (error) {
    throw new WebsiteVerificationInfrastructureFailure('npm registry request failed', { cause: error })
  }
  if (!response.ok) {
    throw new WebsiteVerificationInfrastructureFailure(`npm registry returned HTTP ${response.status}`)
  }
  return response.json()
}

async function findInstalledManifest(moduleEntryPath, packageName) {
  let directory = dirname(moduleEntryPath)
  while (true) {
    const manifestPath = join(directory, 'package.json')
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
      if (manifest.name === packageName) {
        return {
          manifestName: manifest.name,
          manifestVersion: manifest.version,
          manifestPath: await realpath(manifestPath),
          moduleEntryPath: await realpath(moduleEntryPath),
        }
      }
    }
    catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  fail(`could not find the installed manifest for ${packageName}`)
}

async function defaultResolveInstalledPackage(websiteManifestPath, packageName) {
  const websiteRequire = createRequire(websiteManifestPath)
  return findInstalledManifest(websiteRequire.resolve(packageName), packageName)
}

async function defaultLoadNuxtModules(websiteRoot) {
  const config = await loadNuxtConfig({ cwd: websiteRoot })
  return (config.modules ?? []).map(module => Array.isArray(module) ? module[0] : module)
}

function lockfileIdentity(lockfile, packageName, expectedVersion) {
  const dependency = lockfile?.importers?.website?.dependencies?.[packageName]
  const resolvedVersion = String(dependency?.version ?? '').split('(')[0]
  const snapshot = lockfile?.packages?.[`${packageName}@${expectedVersion}`]
  return {
    specifier: dependency?.specifier,
    version: resolvedVersion,
    integrity: snapshot?.resolution?.integrity,
  }
}

function readDisclosure(html) {
  const match = html.match(/data-artifact-version=["']([^"']+)["']/)
  return match?.[1]
}

export async function verifyWebsiteArtifactIdentity({
  repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url))),
  readText = path => readFile(path, 'utf8'),
  resolveInstalledPackage = defaultResolveInstalledPackage,
  loadNuxtModules = defaultLoadNuxtModules,
  fetchRegistryMetadata = defaultFetchRegistryMetadata,
} = {}) {
  try {
    const root = resolve(repositoryRoot)
    const websiteRoot = join(root, 'website')
    const websiteManifestPath = join(websiteRoot, 'package.json')
    const [workspaceSource, websiteSource, lockfileSource, homepageSource, registry, installed, nuxtModules]
      = await Promise.all([
        readText(join(root, 'pnpm-workspace.yaml')),
        readText(websiteManifestPath),
        readText(join(root, 'pnpm-lock.yaml')),
        readText(join(websiteRoot, '.output/public/index.html')),
        fetchRegistryMetadata(),
        resolveInstalledPackage(websiteManifestPath, PACKAGE_NAME),
        loadNuxtModules(websiteRoot),
      ])
    const workspace = parse(workspaceSource)
    const website = JSON.parse(websiteSource)
    const lockfile = parse(lockfileSource)

    return validateWebsiteArtifactIdentity({
      repositoryRoot: root,
      packageName: PACKAGE_NAME,
      expectedVersion: EXPECTED_VERSION,
      websiteSpecifier: website.dependencies?.[PACKAGE_NAME],
      workspace,
      lockfile: lockfileIdentity(lockfile, PACKAGE_NAME, EXPECTED_VERSION),
      registry,
      installed,
      nuxtModules,
      disclosure: readDisclosure(homepageSource),
    })
  }
  catch (error) {
    if (error instanceof WebsiteArtifactIntegrationFailure
      || error instanceof WebsiteVerificationInfrastructureFailure) {
      throw error
    }
    throw new WebsiteArtifactIntegrationFailure(error instanceof Error ? error.message : String(error))
  }
}

async function main() {
  try {
    console.log(JSON.stringify(await verifyWebsiteArtifactIdentity(), null, 2))
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
