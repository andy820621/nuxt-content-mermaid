import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { verifyWebsiteArtifactIdentity } from './artifact.mjs'
import { verifyWebsiteReference } from './reference-verifier.mjs'
import { runWebsiteStaticCli } from './static-site.mjs'

const execFileAsync = promisify(execFile)
const DEFAULT_REPOSITORY_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))

async function defaultRunCommand({ command, args, cwd }) {
  try {
    await execFileAsync(command, args, { cwd, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  }
  catch (error) {
    const output = [error?.stdout, error?.stderr].filter(Boolean).join('\n').trim().slice(-8_000)
    throw new Error(`${command} ${args.join(' ')} failed${output ? `:\n${output}` : ''}`, { cause: error })
  }
}

export async function verifyWebsite({
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  runCommand = defaultRunCommand,
  verifyArtifact = options => verifyWebsiteArtifactIdentity(options),
  verifyReference = options => verifyWebsiteReference(options),
  verifyStatic = options => runWebsiteStaticCli({ ...options, argv: [] }),
} = {}) {
  await runCommand({
    command: 'pnpm',
    args: ['--dir', 'website', 'typecheck'],
    cwd: repositoryRoot,
  })
  await runCommand({
    command: 'pnpm',
    args: ['--dir', 'website', 'generate'],
    cwd: repositoryRoot,
  })

  const artifact = await verifyArtifact({ repositoryRoot })
  const reference = await verifyReference({
    repositoryRoot,
    resolveArtifact: async () => artifact,
  })
  if (!Array.isArray(reference.mismatches) || reference.mismatches.length > 0) {
    throw new Error(`website Reference verification failed: mismatches ${JSON.stringify(reference.mismatches ?? 'missing')}`)
  }
  if (reference.artifact?.version !== artifact.version) {
    throw new Error(`website Reference verification failed: artifact version ${reference.artifact?.version ?? 'missing'} does not match ${artifact.version}`)
  }
  if (reference.recordCount !== 43) {
    throw new Error(`website Reference verification failed: record count ${reference.recordCount ?? 'missing'} does not match 43`)
  }

  const site = await verifyStatic({ repositoryRoot })
  const homepage = site.routes.find(route => route.id === 'home')
  const referenceRoute = site.routes.find(route => route.id === 'reference')
  if (homepage?.artifactVersion !== artifact.version) {
    throw new Error(`website artifact-integration failure: homepage disclosure ${homepage?.artifactVersion} does not match installed artifact ${artifact.version}`)
  }
  if (homepage.svgCount !== 1) {
    throw new Error(`website static-site verification failed: expected one hydrated Mermaid SVG, received ${homepage.svgCount ?? 0}`)
  }
  const expectedReferenceIdentity = `${artifact.packageName}@${artifact.version}`
  const noJavaScriptReference = referenceRoute?.observations?.noJavaScript
  const hydratedReference = referenceRoute?.observations?.hydrated
  const referenceRouteMatches = referenceRoute?.logicalRoute === '/reference'
    && referenceRoute.directUrl === '/reference/'
    && referenceRoute.physicalFile === 'reference/index.html'
    && referenceRoute.prerendered === true
    && referenceRoute.hydrated === true
    && referenceRoute.noJavaScript === true
    && noJavaScriptReference?.identity === expectedReferenceIdentity
    && noJavaScriptReference.recordCount === reference.recordCount
    && noJavaScriptReference.uniqueFragments === reference.recordCount
    && noJavaScriptReference.initialHtmlComplete === true
    && hydratedReference?.identity === expectedReferenceIdentity
    && hydratedReference.recordCount === reference.recordCount
    && hydratedReference.uniqueFragments === reference.recordCount
    && hydratedReference.sameReferencePage === true
  if (!referenceRouteMatches) {
    throw new Error('website Reference route evidence is missing or inconsistent')
  }
  for (const route of site.routes) {
    const count = route.observations?.hydrated?.criticalAccessibilityViolations
    if (count !== 0) {
      throw new Error(`website static-site verification failed: ${route.id} hydrated critical accessibility evidence is ${count ?? 'missing'}`)
    }
  }

  return {
    mode: 'website-verification',
    artifact,
    reference,
    site,
    correlation: {
      artifactVersion: artifact.version,
      homepageDisclosure: homepage.artifactVersion,
      hydratedSvgCount: homepage.svgCount,
      referenceRecordCount: reference.recordCount,
      referenceIdentity: expectedReferenceIdentity,
    },
  }
}

async function main() {
  try {
    console.log(JSON.stringify(await verifyWebsite(), null, 2))
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
