import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { runBrowserSmoke } from './browser-smoke.mjs'
import { parseExactSemver } from './exact-semver.mjs'
import {
  createReleaseVerificationFailure,
} from './failure-classification.mjs'

const PACKAGE_NAME = '@barzhsieh/nuxt-content-mermaid'
const COMMAND_OUTPUT_LIMIT = 8_000
const CONSUMER_TEMPLATE_FILES = new Set([
  'app.vue',
  'content.config.ts',
  'content/index.md',
  'nuxt.config.ts',
  'package.template.json',
  'type-contracts/package-user.ts',
  'type-contracts/removed-transform.ts',
  'type-contracts/tsconfig.json',
  'type-contracts/v3-configuration.ts',
  'verify-package-root.mjs',
])

function assertExactRegistryVersion(version) {
  if (!parseExactSemver(version)) {
    throw new Error('Registry smoke requires an exact package version')
  }
}

function packageDependency(packageSource) {
  if (packageSource?.kind === 'artifact') {
    return {
      name: packageSource.artifact.packageName,
      version: packageSource.artifact.packageVersion,
      dependency: pathToFileURL(packageSource.artifact.archivePath).href,
    }
  }
  if (packageSource?.kind === 'registry') {
    assertExactRegistryVersion(packageSource.packageVersion)
    return {
      name: packageSource.packageName,
      version: packageSource.packageVersion,
      dependency: packageSource.packageVersion,
    }
  }
  throw new Error(`Unsupported consumer package source: ${packageSource?.kind}`)
}
const execFileAsync = promisify(execFile)

function outputTail(output) {
  return String(output ?? '').trim().slice(-COMMAND_OUTPUT_LIMIT)
}

export async function runCommand({ command, args, cwd, env }) {
  try {
    return await execFileAsync(command, args, {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, ...env },
      maxBuffer: 10 * 1024 * 1024,
    })
  }
  catch (error) {
    const stdout = outputTail(error && typeof error === 'object' ? error.stdout : '')
    const stderr = outputTail(error && typeof error === 'object' ? error.stderr : '')
    const diagnostics = [
      error instanceof Error ? error.message : String(error),
      ...(stdout ? [`stdout:\n${stdout}`] : []),
      ...(stderr ? [`stderr:\n${stderr}`] : []),
    ]
    const diagnostic = diagnostics.join('\n')
    throw createReleaseVerificationFailure(diagnostic, { cause: error, diagnostic })
  }
}

function isWithin(parent, candidate) {
  const relativePath = relative(parent, candidate)
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

async function readTemplateFiles(directory, root = directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    const relativePath = relative(root, path)
    if (entry.name === 'node_modules') {
      throw new Error('Clean consumer template contains pre-existing node_modules')
    }
    if (entry.isSymbolicLink()) {
      throw new Error(`Clean consumer template contains a symbolic link: ${relativePath}`)
    }
    if (entry.isDirectory()) {
      files.push(...await readTemplateFiles(path, root))
    }
    else if (entry.isFile()) {
      files.push({ path, relativePath: relativePath.replaceAll('\\', '/') })
    }
  }
  return files
}

async function assertTemplateIsClean(templateDirectory) {
  const files = await readTemplateFiles(templateDirectory)
  for (const file of files) {
    const content = await readFile(file.path, 'utf8')
    const importsMermaid = /from\s+['"]mermaid(?:\/[^'"]*)?['"]/.test(content)
      || /import\(\s*['"]mermaid(?:\/[^'"]*)?['"]/.test(content)
    if (/(?:^|\/)components(?:\/.*)?\/mermaid\.[^/]+$/i.test(file.relativePath)) {
      throw new Error(`Clean consumer template uses a Mermaid substitution in ${file.relativePath}`)
    }
    if (!CONSUMER_TEMPLATE_FILES.has(file.relativePath)) {
      throw new Error(`Clean consumer template contains an unexpected file: ${file.relativePath}`)
    }
    if (content.includes('workspace:')) {
      throw new Error(`Clean consumer template uses a workspace protocol in ${file.relativePath}`)
    }
    if (content.includes('mermaid-stub')
      || /\brenderer\s*:/.test(content)
      || /<svg(?:\s|>)/i.test(content)
      || importsMermaid) {
      throw new Error(`Clean consumer template uses a Mermaid substitution in ${file.relativePath}`)
    }
    if (/(?:^|[\s'"`])(?:\.\.\/)+src\/module(?:\.[cm]?[jt]s)?/.test(content)) {
      throw new Error(`Clean consumer template uses a repository-relative module path in ${file.relativePath}`)
    }
    if (file.relativePath.startsWith('nuxt.config.')
      && content.includes('alias')
      && content.includes(PACKAGE_NAME)) {
      throw new Error(`Clean consumer template aliases the package source in ${file.relativePath}`)
    }
  }
}

async function assertEmptyConsumerDirectory(consumerDirectory) {
  const entries = await readdir(consumerDirectory)
  if (entries.length > 0) {
    throw new Error('Clean consumer directory contains pre-existing installation state')
  }
}

async function expectedPackageVersion(manifestPath, packageName, expectedVersion) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (manifest.name !== packageName) {
    throw new Error(`Installed package identity mismatch for ${packageName}: received ${manifest.name}`)
  }
  if (manifest.version !== expectedVersion) {
    throw new Error(`Installed package version mismatch for ${packageName}: expected ${expectedVersion}, received ${manifest.version}`)
  }
  return manifest.version
}

async function installedPackageVersion(consumerDirectory, packageName, expectedVersion) {
  const nodeModulesDirectory = resolve(consumerDirectory, 'node_modules')
  const resolvedNodeModulesDirectory = await realpath(nodeModulesDirectory)
  const packageDirectory = join(nodeModulesDirectory, ...packageName.split('/'))
  const packageStat = await lstat(packageDirectory)
  const resolvedPackageDirectory = await realpath(packageDirectory)

  if (packageStat.isSymbolicLink()
    || !isWithin(resolvedNodeModulesDirectory, resolvedPackageDirectory)) {
    throw new Error(`Installed package ${packageName} resolves outside the clean consumer`)
  }

  return expectedPackageVersion(
    join(resolvedPackageDirectory, 'package.json'),
    packageName,
    expectedVersion,
  )
}

async function installedDependencyVersion({
  consumerDirectory,
  issuerPackageName,
  dependencyPackageName,
  expectedVersion,
}) {
  const nodeModulesDirectory = resolve(consumerDirectory, 'node_modules')
  const resolvedNodeModulesDirectory = await realpath(nodeModulesDirectory)
  const issuerManifestPath = join(
    nodeModulesDirectory,
    ...issuerPackageName.split('/'),
    'package.json',
  )
  const dependencyManifestPath = createRequire(issuerManifestPath)
    .resolve(`${dependencyPackageName}/package.json`)
  const resolvedDependencyManifestPath = await realpath(dependencyManifestPath)

  if (!isWithin(resolvedNodeModulesDirectory, resolvedDependencyManifestPath)) {
    throw new Error(
      `Installed dependency ${dependencyPackageName} resolves outside the clean consumer`,
    )
  }

  return expectedPackageVersion(
    resolvedDependencyManifestPath,
    dependencyPackageName,
    expectedVersion,
  )
}

function parsePackResult(output) {
  const text = String(output ?? '').trim()
  for (let start = text.length - 1; start >= 0; start--) {
    if (text[start] !== '{' && text[start] !== '[') continue
    try {
      const parsed = JSON.parse(text.slice(start))
      if (Array.isArray(parsed) && parsed.length === 1) return parsed[0]
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    }
    catch {
      // Search backward for the outer JSON value after lifecycle output.
    }
  }
  throw new Error('pnpm pack did not return valid JSON artifact metadata')
}

async function createArtifact({ repositoryRoot, artifactDirectory, commandRunner }) {
  if ((await readdir(artifactDirectory)).length > 0) {
    throw new Error('Artifact directory contains pre-existing state')
  }

  const result = await commandRunner({
    command: 'pnpm',
    args: ['pack', '--json', '--pack-destination', artifactDirectory],
    cwd: repositoryRoot,
  })
  const tarballs = (await readdir(artifactDirectory))
    .filter(filename => filename.endsWith('.tgz'))
  if (tarballs.length !== 1) {
    throw new Error(`pnpm pack must produce exactly one tarball; found ${tarballs.length}`)
  }

  const packResult = parsePackResult(result?.stdout)
  if (basename(packResult.filename ?? '') !== tarballs[0]) {
    throw new Error(
      `pnpm pack artifact metadata mismatch: expected ${tarballs[0]}, received ${packResult.filename}`,
    )
  }
  if (typeof packResult.name !== 'string' || typeof packResult.version !== 'string') {
    throw new TypeError('pnpm pack artifact metadata is missing package name or version')
  }
  if (!Array.isArray(packResult.files)
    || packResult.files.some(file => (
      !file
      || typeof file !== 'object'
      || typeof file.path !== 'string'
      || file.path.length === 0
    ))) {
    throw new TypeError('pnpm pack artifact metadata is missing a valid packlist')
  }

  const archivePath = resolve(artifactDirectory, tarballs[0])
  if (!isWithin(resolve(artifactDirectory), archivePath)) {
    throw new Error(`pnpm pack artifact escapes the artifact directory: ${tarballs[0]}`)
  }
  const archiveBytes = await readFile(archivePath)
  return {
    archivePath,
    filename: tarballs[0],
    sha256: createHash('sha256').update(archiveBytes).digest('hex'),
    integritySha512: `sha512-${createHash('sha512').update(archiveBytes).digest('base64')}`,
    packlist: packResult.files.map(file => file.path),
    packageName: packResult.name,
    packageVersion: packResult.version,
  }
}

function collectStringLeaves(value) {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collectStringLeaves)
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectStringLeaves)
  }
  return []
}

function publicPackageTargets(manifest) {
  if (!manifest.exports) {
    throw new Error('Archive package metadata does not define public exports')
  }

  const targets = [
    ...collectStringLeaves(manifest.exports),
    ...(typeof manifest.main === 'string' ? [manifest.main] : []),
    ...(typeof manifest.types === 'string' ? [manifest.types] : []),
    ...collectStringLeaves(manifest.typesVersions),
  ]
  return [...new Set(targets)]
}

function assertArchiveContractValue(field, received, expected) {
  if (received !== expected) {
    throw new Error(
      `Archive dependency contract mismatch: ${field}; expected ${expected}, received ${received}`,
    )
  }
}

function assertArchiveDependencyContract(manifest) {
  assertArchiveContractValue('engines.node', manifest.engines?.node, '>=22.19.0')
  assertArchiveContractValue('peerDependencies.nuxt', manifest.peerDependencies?.nuxt, '^4.1.0')
  assertArchiveContractValue(
    'peerDependencies.@nuxt/content',
    manifest.peerDependencies?.['@nuxt/content'],
    '>=3.5.0 <4.0.0',
  )
  assertArchiveContractValue('dependencies.@nuxt/kit', manifest.dependencies?.['@nuxt/kit'], '^4.5.2')
  assertArchiveContractValue('dependencies.mermaid', manifest.dependencies?.mermaid, '~11.16.1')
}

async function inspectArchive({ archiveDirectory, artifact, commandRunner }) {
  if ((await readdir(archiveDirectory)).length > 0) {
    throw new Error('Archive inspection directory contains pre-existing state')
  }

  const listingResult = await commandRunner({
    command: 'tar',
    args: ['-tzf', artifact.archivePath],
    cwd: archiveDirectory,
  })
  const entries = String(listingResult?.stdout ?? '')
    .split(/\r?\n/)
    .filter(Boolean)
  if (entries.length === 0) {
    throw new Error('Package archive is empty')
  }
  for (const entry of entries) {
    const normalizedEntry = entry.replace(/\/$/, '')
    const pathSegments = normalizedEntry.split('/')
    if (isAbsolute(normalizedEntry)
      || pathSegments.includes('..')
      || (!normalizedEntry.startsWith('package/') && normalizedEntry !== 'package')) {
      throw new Error(`Package archive contains an unsafe entry: ${entry}`)
    }
  }

  await commandRunner({
    command: 'tar',
    args: ['-xzf', artifact.archivePath, '-C', archiveDirectory],
    cwd: archiveDirectory,
  })

  const packageDirectory = resolve(archiveDirectory, 'package')
  const manifest = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'))
  if (manifest.name !== artifact.packageName || manifest.version !== artifact.packageVersion) {
    throw new Error(
      `Archive package identity mismatch: expected ${artifact.packageName}@${artifact.packageVersion}, received ${manifest.name}@${manifest.version}`,
    )
  }
  assertArchiveDependencyContract(manifest)

  const targets = publicPackageTargets(manifest)
  for (const target of targets) {
    if (!target.startsWith('./')) {
      throw new Error(`Archive target escapes the package boundary: ${target}`)
    }
    const targetPath = resolve(packageDirectory, target)
    if (!isWithin(packageDirectory, targetPath)) {
      throw new Error(`Archive target escapes the package boundary: ${target}`)
    }

    let targetStat
    try {
      targetStat = await lstat(targetPath)
    }
    catch (error) {
      if (error && typeof error === 'object' && error.code === 'ENOENT') {
        throw new Error(`Archive target does not exist: ${target}`)
      }
      throw error
    }
    if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
      throw new Error(`Archive target is not a package-owned file: ${target}`)
    }
  }
}

async function installConsumer({
  packageSource,
  consumerDirectory,
  profile,
  templateDirectory,
  commandRunner,
}) {
  const source = packageDependency(packageSource)
  await assertTemplateIsClean(templateDirectory)
  await assertEmptyConsumerDirectory(consumerDirectory)

  const templateManifestPath = join(templateDirectory, 'package.template.json')
  const templateManifest = JSON.parse(await readFile(templateManifestPath, 'utf8'))
  if (templateManifest.dependencies
    || templateManifest.devDependencies
    || templateManifest.optionalDependencies
    || templateManifest.peerDependencies
    || templateManifest.overrides
    || templateManifest.resolutions
    || templateManifest.pnpm) {
    throw new Error('Clean consumer template dependencies must come from the selected package source and Version Profile')
  }

  await cp(templateDirectory, consumerDirectory, { recursive: true })
  await rm(join(consumerDirectory, 'package.template.json'))
  const expectedResolutions = profile.expectedResolutions
  await writeFile(join(consumerDirectory, 'package.json'), `${JSON.stringify({
    ...templateManifest,
    dependencies: {
      [source.name]: source.dependency,
      '@nuxt/content': profile.versions.nuxtContent,
      'better-sqlite3': profile.versions.betterSqlite3,
      'mermaid': profile.versions.mermaid,
      'nuxt': profile.versions.nuxt,
    },
    devDependencies: {
      ...(expectedResolutions
        ? { '@nuxt/schema': expectedResolutions.nuxtSchema }
        : {}),
      'typescript': profile.versions.typescript,
      'vue-tsc': profile.versions.vueTsc,
    },
    ...(expectedResolutions
      ? {
          overrides: {
            '@nuxt/kit': expectedResolutions.nuxtKit,
            '@nuxt/schema': expectedResolutions.nuxtSchema,
          },
        }
      : {}),
  }, null, 2)}\n`)

  await commandRunner({
    command: 'npm',
    args: ['install', '--no-audit', '--no-fund', '--package-lock=true'],
    cwd: consumerDirectory,
  })

  const resolvedPackageVersion = await installedPackageVersion(
    consumerDirectory,
    source.name,
    source.version,
  )
  const resolvedMermaidVersion = await installedDependencyVersion({
    consumerDirectory,
    issuerPackageName: source.name,
    dependencyPackageName: 'mermaid',
    expectedVersion: profile.versions.mermaid,
  })
  const resolvedExpectedResolutions = expectedResolutions
    ? {
        nuxtKit: await installedDependencyVersion({
          consumerDirectory,
          issuerPackageName: source.name,
          dependencyPackageName: '@nuxt/kit',
          expectedVersion: expectedResolutions.nuxtKit,
        }),
        nuxtSchema: await installedDependencyVersion({
          consumerDirectory,
          issuerPackageName: 'nuxt',
          dependencyPackageName: '@nuxt/schema',
          expectedVersion: expectedResolutions.nuxtSchema,
        }),
      }
    : undefined

  return {
    packageVersion: resolvedPackageVersion,
    profileVersions: {
      betterSqlite3: await installedPackageVersion(
        consumerDirectory,
        'better-sqlite3',
        profile.versions.betterSqlite3,
      ),
      nuxt: await installedPackageVersion(consumerDirectory, 'nuxt', profile.versions.nuxt),
      nuxtContent: await installedPackageVersion(
        consumerDirectory,
        '@nuxt/content',
        profile.versions.nuxtContent,
      ),
      mermaid: resolvedMermaidVersion,
      typescript: await installedPackageVersion(
        consumerDirectory,
        'typescript',
        profile.versions.typescript,
      ),
      vueTsc: await installedPackageVersion(
        consumerDirectory,
        'vue-tsc',
        profile.versions.vueTsc,
      ),
    },
    ...(resolvedExpectedResolutions
      ? { expectedResolutions: resolvedExpectedResolutions }
      : {}),
  }
}

export function createReleaseVerificationOperations({
  templateDirectory,
  commandRunner = runCommand,
  runtimeSmoke = runBrowserSmoke,
  temporaryRoot = tmpdir(),
}) {
  const createdWorkspaceRoots = new Set()

  return {
    async createWorkspace() {
      const root = await mkdtemp(join(temporaryRoot, 'nuxt-content-mermaid-package-artifact-'))
      try {
        const workspace = {
          root,
          artifactDirectory: join(root, 'artifact'),
          archiveDirectory: join(root, 'archive'),
          consumerDirectory: join(root, 'consumer'),
        }
        await Promise.all([
          mkdir(workspace.artifactDirectory),
          mkdir(workspace.archiveDirectory),
          mkdir(workspace.consumerDirectory),
        ])
        createdWorkspaceRoots.add(root)
        return workspace
      }
      catch (error) {
        await rm(root, { recursive: true, force: true })
        throw error
      }
    },
    createArtifact: input => createArtifact({
      ...input,
      commandRunner,
    }),
    inspectArchive: input => inspectArchive({
      ...input,
      commandRunner,
    }),
    installConsumer: input => installConsumer({
      ...input,
      templateDirectory,
      commandRunner,
    }),
    async verifyPackageExports({ consumerDirectory }) {
      await commandRunner({
        command: process.execPath,
        args: [join(consumerDirectory, 'verify-package-root.mjs')],
        cwd: consumerDirectory,
      })
    },
    async verifyTypes({ consumerDirectory }) {
      await commandRunner({
        command: join(
          consumerDirectory,
          'node_modules',
          '.bin',
          process.platform === 'win32' ? 'vue-tsc.cmd' : 'vue-tsc',
        ),
        args: ['-p', 'type-contracts/tsconfig.json', '--noEmit'],
        cwd: consumerDirectory,
      })
    },
    async buildConsumer({ consumerDirectory }) {
      await commandRunner({
        command: join(
          consumerDirectory,
          'node_modules',
          '.bin',
          process.platform === 'win32' ? 'nuxt.cmd' : 'nuxt',
        ),
        args: ['build'],
        cwd: consumerDirectory,
        env: { NODE_ENV: 'production' },
      })
    },
    smokeRuntime: ({ consumerDirectory }) => runtimeSmoke({ consumerDirectory }),
    async cleanupWorkspace(workspaceRoot) {
      if (!createdWorkspaceRoots.has(workspaceRoot)) {
        throw new Error(`Refusing to clean an unknown verification workspace: ${workspaceRoot}`)
      }
      await rm(workspaceRoot, {
        recursive: true,
        force: true,
        maxRetries: 3,
      })
      createdWorkspaceRoots.delete(workspaceRoot)
    },
  }
}
