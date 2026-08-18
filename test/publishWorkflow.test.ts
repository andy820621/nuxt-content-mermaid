import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

type WorkflowStep = {
  env?: Record<string, string>
  id?: string
  name?: string
  run?: string
  uses?: string
  with?: Record<string, unknown>
}

type WorkflowJob = {
  permissions?: Record<string, string>
  steps: WorkflowStep[]
  [key: string]: unknown
}

type ParsedWorkflow = {
  concurrency: Record<string, unknown>
  jobs: {
    publish: WorkflowJob
  }
  on: Record<string, unknown>
  permissions: Record<string, string>
}

async function readWorkflow() {
  const source = await readFile('.github/workflows/publish.yml', 'utf8')
  return {
    source,
    workflow: parse(source) as ParsedWorkflow,
  }
}

function runCommands(job: WorkflowJob) {
  return job.steps.flatMap(step => step.run ? [step.run] : [])
}

describe('stable publish workflow contract', () => {
  it('starts from an immutable version tag and serializes stable releases', async () => {
    const { workflow } = await readWorkflow()

    expect(workflow.on).toEqual({
      push: {
        tags: ['v*'],
      },
    })
    expect(workflow.permissions).toEqual({})
    expect(workflow.concurrency).toEqual({
      'group': 'nuxt-content-mermaid-stable-release',
      'cancel-in-progress': false,
    })
  })

  it('uses one job with only the permissions needed for OIDC and GitHub Release', async () => {
    const { workflow } = await readWorkflow()

    expect(Object.keys(workflow.jobs)).toEqual(['publish'])
    expect(workflow.jobs.publish).toMatchObject({
      'runs-on': 'ubuntu-latest',
      'permissions': {
        'contents': 'write',
        'id-token': 'write',
      },
    })
  })

  it('validates release identity and uses pinned release tooling', async () => {
    const { workflow } = await readWorkflow()
    const publish = workflow.jobs.publish
    const commands = runCommands(publish).join('\n')
    const checkout = publish.steps.find(step => step.uses === 'actions/checkout@v6')
    const setupNode = publish.steps.find(step => step.uses === 'actions/setup-node@v6')

    expect(checkout?.with).toEqual({ 'fetch-depth': 0 })
    expect(setupNode?.with).toEqual({
      'node-version': '24.19.0',
      'registry-url': 'https://registry.npmjs.org',
    })
    expect(commands).toContain('git cat-file -t')
    expect(commands).toContain('package.json')
    expect(commands).toContain('CHANGELOG.md')
    expect(commands).toContain('npm@11.17.0')
    expect(commands).toContain('corepack@0.35.0')
    expect(commands).toContain('pnpm install --frozen-lockfile')
  })

  it('verifies and publishes the exact same tarball once through npm OIDC', async () => {
    const { source, workflow } = await readWorkflow()
    const publish = workflow.jobs.publish
    const commands = runCommands(publish).join('\n')
    const publishStep = publish.steps.find(step => step.name === 'Publish verified package')

    expect(source.match(/package-artifact\.mjs/g)).toHaveLength(1)
    expect(commands).toContain('--profile v3-known-latest')
    expect(commands).toContain('--artifact-directory "$ARTIFACT_DIRECTORY"')
    expect(commands).not.toMatch(/\+\s+--/)
    expect(commands).toContain('playwright install --with-deps chromium')
    expect(publishStep?.env).toEqual({
      PACKAGE_ARCHIVE: '${{ steps.artifact.outputs.archive }}',
    })
    expect(publishStep?.run).toContain('npm publish "$PACKAGE_ARCHIVE"')
    expect(publishStep?.run).toContain('--access public')
    expect(publishStep?.run).toContain('--tag latest')
    expect(publishStep?.run).toContain('--ignore-scripts')
    expect(publishStep?.run).toContain('--provenance')
    expect(source).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN/)
    expect(source).not.toMatch(/actions\/(?:upload|download)-artifact/)
    expect(source).not.toMatch(/registry-smoke|release-workflow\.mjs/)
  })

  it('creates the GitHub Release only after npm publication', async () => {
    const { workflow } = await readWorkflow()
    const publish = workflow.jobs.publish
    const publishIndex = publish.steps.findIndex(step => step.name === 'Publish verified package')
    const releaseIndex = publish.steps.findIndex(step => step.name === 'Create GitHub Release')
    const release = publish.steps[releaseIndex]

    expect(publishIndex).toBeGreaterThan(-1)
    expect(releaseIndex).toBeGreaterThan(publishIndex)
    expect(release?.env).toEqual({
      GITHUB_TOKEN: '${{ github.token }}',
    })
    expect(release?.run).toContain('changelogen gh release')
  })
})
