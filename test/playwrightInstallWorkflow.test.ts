import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

type WorkflowStep = {
  'name'?: string
  'run'?: string
  'timeout-minutes'?: number
  'continue-on-error'?: boolean
}

type Workflow = {
  jobs: Record<string, { steps: WorkflowStep[] }>
}

describe.each([
  { path: '.github/workflows/ci.yml', job: 'source-verification', command: 'npx playwright install --with-deps chromium' },
  { path: '.github/workflows/ci.yml', job: 'package-compatibility-profiles', command: 'npx playwright install --with-deps chromium' },
  { path: '.github/workflows/publish.yml', job: 'publish', command: 'pnpm exec playwright install --with-deps chromium' },
])('Playwright installation in $path ($job)', ({ path, job, command }) => {
  it.each([
    { scenario: 'succeeds immediately', successfulAttempt: 1, attempts: 1, exitCode: 0 },
    { scenario: 'succeeds on the second attempt', successfulAttempt: 2, attempts: 2, exitCode: 0 },
    { scenario: 'fails after both attempts', successfulAttempt: 3, attempts: 2, exitCode: 17 },
  ])('$scenario', ({ successfulAttempt, attempts, exitCode }) => {
    const workflow = parse(readFileSync(path, 'utf8')) as Workflow
    const step = workflow.jobs[job]?.steps.find(step => step.name?.startsWith('Install Playwright browser'))

    expect(step?.run).toBeDefined()
    expect(step?.['timeout-minutes']).toBe(10)
    expect(step?.['continue-on-error']).not.toBe(true)

    const result = spawnSync('/bin/bash', ['-e', '-o', 'pipefail', '-c', `
      attempt=0
      install() {
        attempt=$((attempt + 1))
        echo "install: $*"
        if [ "$attempt" -lt ${successfulAttempt} ]; then
          return 17
        fi
        return 0
      }
      npx() { install npx "$@"; }
      pnpm() { install pnpm "$@"; }
      sleep() { echo "sleep: $*"; }
      ${step?.run}
    `], {
      encoding: 'utf8',
      env: { PATH: '' },
      timeout: 5000,
    })
    const output = result.stdout.split('\n').filter(Boolean)

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(exitCode)
    expect(result.stderr).toBe('')
    expect(output.filter(line => line.startsWith('install:'))).toEqual(
      Array.from({ length: attempts }, () => `install: ${command}`),
    )
    expect(output.filter(line => line.startsWith('sleep:'))).toEqual(attempts === 1 ? [] : ['sleep: 15'])
    expect(output.filter(line => line.startsWith('::warning::'))).toHaveLength(attempts - 1)
  })
})
