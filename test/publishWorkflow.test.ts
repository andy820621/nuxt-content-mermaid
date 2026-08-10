import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

type WorkflowStep = {
  id?: string
  name?: string
  uses?: string
  run?: string
  with?: Record<string, unknown>
}

type WorkflowJob = {
  needs?: string | string[]
  outputs?: Record<string, string>
  permissions?: Record<string, string>
  strategy?: Record<string, unknown>
  steps: WorkflowStep[]
  [key: string]: unknown
}

type ParsedWorkflow = {
  on: Record<string, unknown>
  permissions: Record<string, string>
  concurrency: Record<string, unknown>
  jobs: Record<string, WorkflowJob>
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

function requireJob(workflow: ParsedWorkflow, name: string) {
  const job = workflow.jobs[name]
  if (!job) throw new Error(`Workflow is missing job: ${name}`)
  return job
}

describe('stable publish workflow contract', () => {
  it('has one manual stable-version input and repository-wide non-cancelling concurrency', async () => {
    const { workflow } = await readWorkflow()

    expect(workflow.on).toEqual({
      workflow_dispatch: {
        inputs: {
          version: {
            description: expect.any(String),
            required: true,
            type: 'string',
          },
        },
      },
    })
    expect(workflow.permissions).toEqual({})
    expect(workflow.concurrency).toEqual({
      'group': 'nuxt-content-mermaid-stable-release',
      'cancel-in-progress': false,
    })
  })

  it('uses the required five-job DAG and least job-level permissions', async () => {
    const { workflow } = await readWorkflow()
    const jobs = workflow.jobs

    expect(Object.keys(jobs)).toEqual([
      'verify-and-pack',
      'smoke',
      'publish',
      'registry-smoke',
      'finalize',
    ])
    expect(requireJob(workflow, 'verify-and-pack').permissions).toEqual({
      'contents': 'read',
      'pull-requests': 'read',
    })
    expect(requireJob(workflow, 'smoke')).toMatchObject({
      needs: 'verify-and-pack',
      permissions: { contents: 'read' },
    })
    expect(requireJob(workflow, 'publish')).toMatchObject({
      needs: ['verify-and-pack', 'smoke'],
      permissions: { 'contents': 'read', 'id-token': 'write' },
    })
    expect(requireJob(workflow, 'registry-smoke')).toMatchObject({
      needs: ['verify-and-pack', 'publish'],
      permissions: { contents: 'read' },
    })
    expect(requireJob(workflow, 'finalize')).toMatchObject({
      needs: ['verify-and-pack', 'registry-smoke'],
      permissions: { contents: 'write' },
    })
    expect(Object.values(jobs).every(job => job['runs-on'] === 'ubuntu-latest')).toBe(true)
  })

  it('pins the two compatibility runtimes and current official action majors', async () => {
    const { workflow } = await readWorkflow()
    const smoke = requireJob(workflow, 'smoke')

    expect(smoke.strategy).toEqual({
      'fail-fast': false,
      'matrix': {
        include: [
          { 'profile': 'v3-minimum', 'node-version': '22.19.0' },
          { 'profile': 'v3-known-latest', 'node-version': '24.19.0' },
        ],
      },
    })
    const allUses = Object.values(workflow.jobs)
      .flatMap(job => job.steps.flatMap(step => step.uses ?? []))
    expect(allUses.filter(uses => uses.startsWith('actions/checkout@')))
      .toEqual(expect.arrayContaining(Array(5).fill('actions/checkout@v6')))
    expect(allUses).toContain('actions/setup-node@v6')
    expect(allUses).toContain('actions/upload-artifact@v7')
    expect(allUses.filter(uses => uses === 'actions/download-artifact@v8')).toHaveLength(2)
    expect(allUses.some(uses => /actions\/(?:checkout|setup-node|upload-artifact|download-artifact)@(?!v[678]$)/.test(uses)))
      .toBe(false)
  })

  it('packs once and transports only one tarball plus its SHA-512 checksum', async () => {
    const { source, workflow } = await readWorkflow()
    const verify = requireJob(workflow, 'verify-and-pack')
    const smokeCommands = runCommands(requireJob(workflow, 'smoke')).join('\n')
    const publishCommands = runCommands(requireJob(workflow, 'publish')).join('\n')

    expect(verify.outputs).toEqual({
      'artifact-name': '${{ steps.identity.outputs.artifact-name }}',
      'archive-filename': '${{ steps.identity.outputs.archive-filename }}',
      'integrity-sha512': '${{ steps.identity.outputs.integrity-sha512 }}',
    })
    expect(source.match(/release-workflow\.mjs pack\b/g)).toHaveLength(1)
    expect(source).not.toMatch(/\bpnpm pack\b/)
    expect(source).not.toMatch(/npm publish/)
    expect(source).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN/)
    expect(smokeCommands).toContain('--package-source artifact')
    expect(smokeCommands).toContain('--checksum')
    expect(publishCommands).toContain('release-workflow.mjs publish')
    expect(publishCommands).toContain('--checksum')
    expect(publishCommands).toContain('npm@11.17.0')

    const upload = verify.steps.find(step => step.uses === 'actions/upload-artifact@v7')
    expect(upload?.with).toMatchObject({
      'name': '${{ steps.identity.outputs.artifact-name }}',
      'if-no-files-found': 'error',
    })
    expect(String(upload?.with?.path)).toContain('*.tgz')
    expect(String(upload?.with?.path)).toContain('artifact.sha512')
  })

  it('keeps Registry Smoke registry-only and finalization strictly last', async () => {
    const { workflow } = await readWorkflow()
    const registry = requireJob(workflow, 'registry-smoke')
    const registryText = JSON.stringify(registry)
    const finalizeText = JSON.stringify(requireJob(workflow, 'finalize'))

    expect(registryText).toContain('release-workflow.mjs registry-smoke')
    expect(registryText).toContain('${{ needs.verify-and-pack.outputs.integrity-sha512 }}')
    expect(registryText).not.toContain('download-artifact')
    expect(registryText).not.toContain('package-artifact.mjs')
    expect(finalizeText).toContain('release-workflow.mjs finalize')
    expect(finalizeText).toContain('${{ github.sha }}')
  })
})
