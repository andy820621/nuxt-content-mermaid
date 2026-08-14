import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

type WorkflowStep = {
  name?: string
  run?: string
}

type WorkflowJob = {
  steps: WorkflowStep[]
}

type Workflow = {
  jobs: Record<string, WorkflowJob>
}

describe('documentation website CI ownership', () => {
  it('runs website verification once in source verification after Playwright installation', async () => {
    const ci = parse(await readFile('.github/workflows/ci.yml', 'utf8')) as Workflow
    const sourceSteps = ci.jobs['source-verification']?.steps ?? []
    const installIndex = sourceSteps.findIndex(step => step.name === 'Install Playwright browsers')
    const websiteIndex = sourceSteps.findIndex(step => step.run === 'pnpm verify:website')
    const allCiCommands = Object.values(ci.jobs)
      .flatMap(job => job.steps.flatMap(step => step.run ?? []))

    expect(installIndex).toBeGreaterThanOrEqual(0)
    expect(websiteIndex).toBeGreaterThan(installIndex)
    expect(sourceSteps[websiteIndex]).toEqual({
      name: 'Verify documentation website',
      run: 'pnpm verify:website',
    })
    expect(allCiCommands.filter(command => command.includes('verify:website'))).toEqual([
      'pnpm verify:website',
    ])
  })

  it('does not add website verification to release or publish workflows', async () => {
    const [ci, publish] = await Promise.all([
      readFile('.github/workflows/ci.yml', 'utf8'),
      readFile('.github/workflows/publish.yml', 'utf8'),
    ])

    expect(publish).not.toContain('verify:website')
    expect(ci.match(/verify:website/g) ?? []).toHaveLength(1)
  })
})
