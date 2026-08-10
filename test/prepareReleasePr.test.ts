import { describe, expect, it, vi } from 'vitest'
import {
  parsePrepareReleasePrArguments,
  runPrepareReleasePr,
} from '../scripts/release-verification/prepare-release-pr.mjs'

describe('release PR preparation', () => {
  it('accepts one stable exact version', () => {
    expect(parsePrepareReleasePrArguments(['3.0.0'])).toEqual({
      targetVersion: '3.0.0',
    })
  })

  it.each([
    [[], 'one stable exact version'],
    [['3.0.0', 'extra'], 'one stable exact version'],
    [['v3.0.0'], 'stable exact version'],
    [['3.0.0-rc.1'], 'stable exact version'],
    [['3.0.0+build.1'], 'stable exact version'],
    [['03.0.0'], 'stable exact version'],
  ])('rejects invalid arguments: %j', (argv, message) => {
    expect(() => parsePrepareReleasePrArguments(argv)).toThrow(message)
  })

  it('stops before mutation when the baseline is dirty', async () => {
    const runCommand = vi.fn()

    await expect(runPrepareReleasePr({
      argv: ['3.0.0'],
      repositoryRoot: '/repo',
      effects: {
        listChangedPaths: vi.fn(async () => ['README.md']),
        runCommand,
      },
    })).rejects.toThrow('clean baseline')

    expect(runCommand).not.toHaveBeenCalled()
  })

  it('only runs Changelogen and a script-free lockfile update', async () => {
    const runCommand = vi.fn(async () => undefined)
    const listChangedPaths = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        'CHANGELOG.md',
        'package.json',
        'pnpm-lock.yaml',
      ])

    await runPrepareReleasePr({
      argv: ['3.0.0'],
      repositoryRoot: '/repo',
      effects: { listChangedPaths, runCommand },
    })

    expect(runCommand.mock.calls).toEqual([
      [{
        command: 'pnpm',
        args: [
          'changelogen',
          '--release',
          '-r',
          '3.0.0',
          '--no-commit',
          '--no-tag',
          '--no-github',
        ],
        cwd: '/repo',
      }],
      [{
        command: 'pnpm',
        args: ['install', '--lockfile-only', '--ignore-scripts'],
        cwd: '/repo',
      }],
    ])
  })

  it('fails closed when preparation changes an unexpected path', async () => {
    const listChangedPaths = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['CHANGELOG.md', 'dist/module.mjs'])

    await expect(runPrepareReleasePr({
      argv: ['3.0.0'],
      repositoryRoot: '/repo',
      effects: {
        listChangedPaths,
        runCommand: vi.fn(async () => undefined),
      },
    })).rejects.toThrow('unexpected path: dist/module.mjs')
  })
})
