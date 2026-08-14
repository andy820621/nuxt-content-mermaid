import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { verifyWebsiteArtifactIdentity } from './artifact.mjs'
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
  const site = await verifyStatic({ repositoryRoot })
  const homepage = site.routes.find(route => route.id === 'home')
  if (homepage?.artifactVersion !== artifact.version) {
    throw new Error(`website artifact-integration failure: homepage disclosure ${homepage?.artifactVersion} does not match installed artifact ${artifact.version}`)
  }
  if (homepage.svgCount !== 1) {
    throw new Error(`website static-site verification failed: expected one hydrated Mermaid SVG, received ${homepage.svgCount ?? 0}`)
  }
  for (const route of site.routes) {
    for (const mode of ['noJavaScript', 'hydrated']) {
      const count = route.observations?.[mode]?.criticalAccessibilityViolations
      if (count !== 0) {
        throw new Error(`website static-site verification failed: ${route.id} ${mode} critical accessibility evidence is ${count ?? 'missing'}`)
      }
    }
  }

  return {
    mode: 'website-verification',
    artifact,
    site,
    correlation: {
      artifactVersion: artifact.version,
      homepageDisclosure: homepage.artifactVersion,
      hydratedSvgCount: homepage.svgCount,
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
