import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

type WorkflowStep = {
  name?: string
  run?: string
}

type CompatibilityJob = {
  steps: WorkflowStep[]
  strategy: {
    'fail-fast': boolean
    'matrix': {
      include: Array<{
        'node-version': string
        'profile': string
      }>
    }
  }
}

type ParsedWorkflow = {
  jobs: Record<string, CompatibilityJob>
}

async function readWorkflow() {
  const source = await readFile('.github/workflows/ci.yml', 'utf8')
  return {
    source,
    workflow: parse(source) as ParsedWorkflow,
  }
}

describe('CI workflow contract', () => {
  it('uses durable package compatibility naming without changing the profiles', async () => {
    const { source, workflow } = await readWorkflow()
    const compatibility = workflow.jobs['package-compatibility-profiles']

    expect(Object.keys(workflow.jobs)).toEqual([
      'source-verification',
      'package-compatibility-profiles',
    ])
    expect(compatibility.strategy).toEqual({
      'fail-fast': false,
      'matrix': {
        include: [
          {
            'profile': 'v3-minimum',
            'node-version': '22.19.0',
          },
          {
            'profile': 'v3-known-latest',
            'node-version': '24.19.0',
          },
        ],
      },
    })
    expect(compatibility.steps.at(-1)).toEqual({
      name: 'Verify Package Compatibility Profile',
      run: 'npm run test:compatibility-profile -- --profile ${{ matrix.profile }}',
    })
    expect(source).not.toContain('final-compatibility')
  })
})
