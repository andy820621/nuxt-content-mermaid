import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

type WorkflowStep = {
  env?: Record<string, string>
  name?: string
  run?: string
  uses?: string
  with?: Record<string, unknown>
}

type CleanupWorkflow = {
  concurrency: Record<string, unknown>
  jobs: {
    cleanup: {
      permissions?: Record<string, string>
      steps: WorkflowStep[]
      [key: string]: unknown
    }
  }
  on: Record<string, unknown>
  permissions: Record<string, string>
}

async function readWorkflow() {
  const source = await readFile('.github/workflows/cleanup-cloudflare-previews.yml', 'utf8')
  return {
    source,
    workflow: parse(source) as CleanupWorkflow,
  }
}

describe('Cloudflare Pages preview cleanup workflow contract', () => {
  it('runs monthly and supports a safe manual dry run', async () => {
    const { workflow } = await readWorkflow()

    expect(workflow.on).toEqual({
      schedule: [{ cron: '17 3 1 * *' }],
      workflow_dispatch: {
        inputs: {
          dry_run: {
            description: 'List expired previews without deleting them',
            required: false,
            default: true,
            type: 'boolean',
          },
        },
      },
    })
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(workflow.concurrency).toEqual({
      'group': 'cloudflare-pages-preview-cleanup',
      'cancel-in-progress': false,
    })
  })

  it('passes scoped credentials to the cleanup script without interpolating them into shell code', async () => {
    const { source, workflow } = await readWorkflow()
    const cleanup = workflow.jobs.cleanup
    const runStep = cleanup.steps.find(step => step.name === 'Clean up expired previews')

    expect(cleanup).toMatchObject({
      'runs-on': 'ubuntu-latest',
      'timeout-minutes': 10,
    })
    expect(runStep).toEqual({
      name: 'Clean up expired previews',
      env: {
        CLOUDFLARE_ACCOUNT_ID: '${{ vars.CLOUDFLARE_ACCOUNT_ID }}',
        CLOUDFLARE_PAGES_API_TOKEN: '${{ secrets.CLOUDFLARE_PAGES_API_TOKEN }}',
        CLOUDFLARE_PAGES_PROJECT: 'nuxt-content-mermaid',
        DRY_RUN: '${{ github.event_name == \'workflow_dispatch\' && inputs.dry_run || false }}',
        PREVIEW_RETENTION_DAYS: '30',
      },
      run: 'node scripts/cloudflare-pages/preview-cleanup.mjs',
    })
    expect(runStep?.run).not.toContain('${{')
    expect(source).not.toMatch(/pull_request|push:/)
  })
})
