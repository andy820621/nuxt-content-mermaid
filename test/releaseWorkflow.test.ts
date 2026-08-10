import { describe, expect, it, vi } from 'vitest'
import {
  createReleaseWorkflowEffects,
  extractChangelogSection,
  parseReleaseWorkflowArguments,
  RELEASE_IMPACT_DIMENSIONS,
  runFinalize,
  runNpmPublish,
  runPack,
  runPreflight,
  runRegistrySmoke,
  validateReleasePullRequest,
} from '../scripts/release-verification/release-workflow.mjs'

type Impact = 'affected' | 'unaffected' | 'uncertain'

const defaultImpacts = Object.fromEntries(
  RELEASE_IMPACT_DIMENSIONS.map(dimension => [dimension, 'unaffected']),
) as Record<string, Impact>

function releaseBody({
  impacts = defaultImpacts,
  evidence = {},
  manual = null,
  targetVersion = '3.0.0',
}: {
  impacts?: Record<string, Impact>
  evidence?: Record<string, string>
  manual?: null | {
    required: boolean
    testCommit?: string
    environment?: string
    scenarios?: string
    result?: string
  }
  targetVersion?: string
} = {}) {
  const rows = RELEASE_IMPACT_DIMENSIONS
    .filter(dimension => dimension in impacts)
    .map(dimension => (
      `| ${dimension} | ${impacts[dimension]} | ${evidence[dimension] ?? `Evidence for ${dimension}`} |`
    )).join('\n')
  const manualLines = manual
    ? [
        `- Required: ${manual.required ? 'yes' : 'no'}`,
        ...(manual.testCommit ? [`- Test commit: ${manual.testCommit}`] : []),
        ...(manual.environment ? [`- Environment: ${manual.environment}`] : []),
        ...(manual.scenarios ? [`- Scenarios: ${manual.scenarios}`] : []),
        ...(manual.result ? [`- Result: ${manual.result}`] : []),
      ]
    : ['- Required: no']

  return `
<!-- release-pr-target -->
- Target version: \`${targetVersion}\`

### Release Impact Declaration

| Dimension | Impact | Evidence |
| --- | --- | --- |
${rows}

### Manual Interaction Verification

${manualLines.join('\n')}
`
}

describe('Release PR validation', () => {
  it('does not add a release gate to an ordinary pull request', () => {
    expect(validateReleasePullRequest({
      body: '## Summary\n\nOrdinary change.',
      baseVersion: '2.2.3',
      headVersion: '2.2.3',
    })).toEqual({ isReleasePullRequest: false })
  })

  it('accepts all six dimensions with evidence when MIV is not triggered', () => {
    expect(validateReleasePullRequest({
      body: releaseBody(),
      baseVersion: '2.2.3',
      headVersion: '3.0.0',
    })).toMatchObject({
      isReleasePullRequest: true,
      targetVersion: '3.0.0',
      manualInteractionVerificationRequired: false,
    })
  })

  it.each(RELEASE_IMPACT_DIMENSIONS)(
    'requires a decision for %s',
    (dimension) => {
      const impacts = Object.fromEntries(
        Object.entries(defaultImpacts).filter(([key]) => key !== dimension),
      ) as Record<string, Impact>

      expect(() => validateReleasePullRequest({
        body: releaseBody({ impacts }),
        baseVersion: '2.2.3',
        headVersion: '3.0.0',
      })).toThrow(`missing dimension: ${dimension}`)
    },
  )

  it.each(RELEASE_IMPACT_DIMENSIONS)(
    'requires non-placeholder evidence for %s',
    (dimension) => {
      expect(() => validateReleasePullRequest({
        body: releaseBody({ evidence: { [dimension]: '<!-- explain -->' } }),
        baseVersion: '2.2.3',
        headVersion: '3.0.0',
      })).toThrow(`missing evidence: ${dimension}`)
    },
  )

  it.each([
    ['interaction', 'affected'],
    ['interaction', 'uncertain'],
    ['styling/layout', 'affected'],
    ['styling/layout', 'uncertain'],
    ['browser APIs', 'affected'],
    ['browser APIs', 'uncertain'],
  ] as const)('requires complete MIV evidence when %s is %s', (dimension, impact) => {
    const impacts = { ...defaultImpacts, [dimension]: impact }

    expect(() => validateReleasePullRequest({
      body: releaseBody({ impacts }),
      baseVersion: '2.2.3',
      headVersion: '3.0.0',
    })).toThrow('Manual Interaction Verification is required')

    expect(validateReleasePullRequest({
      body: releaseBody({
        impacts,
        manual: {
          required: true,
          testCommit: 'abc1234',
          environment: 'macOS 15 / Chrome 139',
          scenarios: `${dimension} release scenarios`,
          result: 'passed',
        },
      }),
      baseVersion: '2.2.3',
      headVersion: '3.0.0',
    })).toMatchObject({ manualInteractionVerificationRequired: true })
  })

  it.each([
    'package contents',
    'runtime behavior',
    'runtime dependencies',
  ])('does not trigger MIV for automated dimension %s', (dimension) => {
    expect(validateReleasePullRequest({
      body: releaseBody({
        impacts: { ...defaultImpacts, [dimension]: 'uncertain' },
      }),
      baseVersion: '2.2.3',
      headVersion: '3.0.0',
    })).toMatchObject({ manualInteractionVerificationRequired: false })
  })

  it('requires a target marker when package version changes', () => {
    expect(() => validateReleasePullRequest({
      body: '## Summary\n\nBump package version.',
      baseVersion: '2.2.3',
      headVersion: '3.0.0',
    })).toThrow('target marker')
  })

  it('rejects an invalid target marker on a replacement Release PR', () => {
    expect(() => validateReleasePullRequest({
      body: '<!-- release-pr-target -->\n- Target version: `<x.y.z>`',
      baseVersion: '3.0.0',
      headVersion: '3.0.0',
    })).toThrow('target marker')
  })

  it('recognizes a replacement Release PR by target marker alone', () => {
    expect(validateReleasePullRequest({
      body: releaseBody(),
      baseVersion: '3.0.0',
      headVersion: '3.0.0',
    })).toMatchObject({
      isReleasePullRequest: true,
      targetVersion: '3.0.0',
    })
  })
})

const packageArtifact = {
  archivePath: '/tmp/release/package-3.0.0.tgz',
  filename: 'package-3.0.0.tgz',
  sha256: 'abc123',
  integritySha512: 'sha512-Zml4dHVyZQ==',
  packlist: ['dist/module.mjs', 'package.json'],
  packageName: '@barzhsieh/nuxt-content-mermaid',
  packageVersion: '3.0.0',
}

const absentNpmState = {
  exact: { state: 'absent' },
  latestVersion: '2.2.3',
}

const publishedNpmState = {
  exact: {
    state: 'published',
    integrity: packageArtifact.integritySha512,
  },
  latestVersion: '3.0.0',
}

function createPreflightEffects(overrides: Record<string, unknown> = {}) {
  return {
    readLocalHead: vi.fn(async () => 'release-sha'),
    readMainHead: vi.fn(async () => 'release-sha'),
    readPackageManifest: vi.fn(async () => ({
      name: packageArtifact.packageName,
      version: '3.0.0',
    })),
    readNpmState: vi.fn(async () => absentNpmState),
    readTagState: vi.fn(async () => ({ state: 'absent' })),
    readGitHubRelease: vi.fn(async () => ({ state: 'absent' })),
    readMergedReleasePullRequest: vi.fn(async () => ({
      state: 'merged',
      baseRef: 'main',
      mergeCommitSha: 'release-sha',
      body: releaseBody(),
    })),
    readChangelog: vi.fn(async () => '# Changelog\n\n## v3.0.0\n\nRelease notes.\n'),
    ...overrides,
  }
}

const preflightRequest = {
  eventName: 'workflow_dispatch',
  ref: 'refs/heads/main',
  sourceCommit: 'release-sha',
  targetVersion: '3.0.0',
}

describe('publish preflight', () => {
  it('accepts a fresh Release PR merge result', async () => {
    await expect(runPreflight({
      request: preflightRequest,
      effects: createPreflightEffects(),
    })).resolves.toMatchObject({
      mode: 'fresh',
      sourceCommit: 'release-sha',
      targetVersion: '3.0.0',
    })
  })

  it.each([
    [{ eventName: 'push' }, 'workflow_dispatch'],
    [{ ref: 'refs/heads/feature' }, 'refs/heads/main'],
    [{ sourceCommit: 'other-sha' }, 'checked-out HEAD'],
    [{ targetVersion: '3.0.0-rc.1' }, 'stable exact version'],
  ])('fails closed for invalid workflow context %j', async (requestOverride, message) => {
    await expect(runPreflight({
      request: { ...preflightRequest, ...requestOverride },
      effects: createPreflightEffects(),
    })).rejects.toThrow(message)
  })

  it.each([
    ['local checkout differs', {
      readLocalHead: vi.fn(async () => 'other-sha'),
    }, 'checked-out HEAD'],
    ['package version differs', {
      readPackageManifest: vi.fn(async () => ({
        name: packageArtifact.packageName,
        version: '3.0.1',
      })),
    }, 'package version'],
    ['target does not advance latest', {
      readNpmState: vi.fn(async () => ({
        exact: { state: 'absent' },
        latestVersion: '3.0.0',
      })),
    }, 'strictly greater'],
    ['merged PR does not match sha', {
      readMergedReleasePullRequest: vi.fn(async () => ({
        state: 'merged',
        baseRef: 'main',
        mergeCommitSha: 'other-sha',
        body: releaseBody(),
      })),
    }, 'merged Release PR'],
    ['merged PR is not a Release PR', {
      readMergedReleasePullRequest: vi.fn(async () => ({
        state: 'merged',
        baseRef: 'main',
        mergeCommitSha: 'release-sha',
        body: '## Summary\n\nOrdinary change.',
      })),
    }, 'merged Release PR'],
    ['fresh release already has a tag', {
      readTagState: vi.fn(async () => ({
        state: 'present',
        annotated: true,
        targetSha: 'release-sha',
      })),
    }, 'fresh release'],
    ['GitHub state is indeterminate', {
      readGitHubRelease: vi.fn(async () => {
        throw new Error('GitHub 503')
      }),
    }, 'GitHub 503'],
  ])('fails closed when %s', async (_label, effectOverride, message) => {
    await expect(runPreflight({
      request: preflightRequest,
      effects: createPreflightEffects(effectOverride),
    })).rejects.toThrow(message)
  })

  it('accepts a replacement Release PR without another version diff', async () => {
    const effects = createPreflightEffects({
      readMergedReleasePullRequest: vi.fn(async () => ({
        state: 'merged',
        baseRef: 'main',
        mergeCommitSha: 'release-sha',
        body: releaseBody(),
      })),
    })

    await expect(runPreflight({
      request: preflightRequest,
      effects,
    })).resolves.toMatchObject({ mode: 'fresh' })
  })

  it('marks an existing exact version as reconciliation-only', async () => {
    const effects = createPreflightEffects({
      readNpmState: vi.fn(async () => publishedNpmState),
      readTagState: vi.fn(async () => ({
        state: 'present',
        annotated: true,
        targetSha: 'release-sha',
      })),
      readGitHubRelease: vi.fn(async () => ({
        state: 'present',
        tagName: 'v3.0.0',
      })),
    })

    await expect(runPreflight({
      request: preflightRequest,
      effects,
    })).resolves.toMatchObject({ mode: 'reconciliation' })
  })
})

describe('npm publication reconciliation', () => {
  function publishEffects(states: unknown[]) {
    return {
      loadArtifact: vi.fn(async () => packageArtifact),
      readNpmState: vi.fn()
        .mockImplementation(async () => states.shift()),
      publishArtifact: vi.fn(async () => undefined),
      wait: vi.fn(async () => undefined),
    }
  }

  const request = {
    targetVersion: '3.0.0',
    archivePath: packageArtifact.archivePath,
    checksumPath: '/tmp/release/artifact.sha512',
  }

  it('publishes one verified absolute tarball when exact is absent', async () => {
    const effects = publishEffects([absentNpmState, publishedNpmState])

    await expect(runNpmPublish({ request, effects })).resolves.toMatchObject({
      action: 'published',
      artifact: packageArtifact,
    })
    expect(effects.publishArtifact).toHaveBeenCalledWith({
      archivePath: packageArtifact.archivePath,
    })
  })

  it.each(['3.0.0', '3.0.1'])(
    'does not publish when npm latest is %s',
    async (latestVersion) => {
      const effects = publishEffects([{
        exact: { state: 'absent' },
        latestVersion,
      }])

      await expect(runNpmPublish({ request, effects })).rejects.toThrow('strictly greater')
      expect(effects.publishArtifact).not.toHaveBeenCalled()
    },
  )

  it('skips publish when exact integrity already matches', async () => {
    const effects = publishEffects([publishedNpmState, publishedNpmState])

    await expect(runNpmPublish({ request, effects })).resolves.toMatchObject({
      action: 'skipped',
    })
    expect(effects.publishArtifact).not.toHaveBeenCalled()
  })

  it.each([
    [{
      exact: { state: 'published', integrity: 'sha512-ZGlmZmVyZW50' },
      latestVersion: '3.0.0',
    }, 'different artifact integrity'],
    [{ exact: { state: 'unknown' }, latestVersion: '3.0.0' }, 'indeterminate'],
  ])('stops without publishing for conflicting npm state %#', async (state, message) => {
    const effects = publishEffects([state])

    await expect(runNpmPublish({ request, effects })).rejects.toThrow(message)
    expect(effects.publishArtifact).not.toHaveBeenCalled()
  })

  it('reconciles an indeterminate publish response through bounded post-check', async () => {
    const effects = publishEffects([absentNpmState, publishedNpmState])
    effects.publishArtifact.mockRejectedValueOnce(new Error('connection reset'))

    await expect(runNpmPublish({ request, effects })).resolves.toMatchObject({
      action: 'published',
    })
  })

  it('stops finalization when bounded post-check never reaches exact/latest', async () => {
    const effects = publishEffects([
      absentNpmState,
      absentNpmState,
      absentNpmState,
      absentNpmState,
    ])

    await expect(runNpmPublish({
      request,
      effects,
      maxAttempts: 3,
    })).rejects.toThrow('post-check did not converge')
  })
})

describe('registry smoke decision', () => {
  it('uses only the exact registry package and fixed Known-Latest profile', async () => {
    const verifyRegistryPackage = vi.fn(async () => ({ success: true }))
    const effects = {
      readNpmState: vi.fn(async () => publishedNpmState),
      verifyRegistryPackage,
    }

    await runRegistrySmoke({
      request: {
        targetVersion: '3.0.0',
        integritySha512: packageArtifact.integritySha512,
      },
      effects,
    })

    expect(verifyRegistryPackage).toHaveBeenCalledWith(expect.objectContaining({
      packageName: packageArtifact.packageName,
      packageVersion: '3.0.0',
      profile: expect.objectContaining({ id: 'v3-known-latest' }),
    }))
  })
})

describe('release finalization reconciliation', () => {
  function finalizeEffects(overrides: Record<string, unknown> = {}) {
    return {
      readTagState: vi.fn(async () => ({ state: 'absent' })),
      readGitHubRelease: vi.fn(async () => ({ state: 'absent' })),
      readChangelog: vi.fn(async () => '# Changelog\n\n## v3.0.0\n\nRelease notes.\n\n## v2.2.3\n\nOld notes.\n'),
      createAnnotatedTag: vi.fn(async () => undefined),
      createGitHubRelease: vi.fn(async () => undefined),
      ...overrides,
    }
  }

  const request = { targetVersion: '3.0.0', sourceCommit: 'release-sha' }

  it('extracts only the target CHANGELOG section', () => {
    expect(extractChangelogSection(
      '# Changelog\n\n## v3.0.0\n\nNew notes.\n\n## v2.2.3\n\nOld notes.\n',
      '3.0.0',
    )).toBe('## v3.0.0\n\nNew notes.')
  })

  it('creates an annotated tag before the GitHub Release', async () => {
    const effects = finalizeEffects()

    await runFinalize({ request, effects })

    expect(effects.createAnnotatedTag).toHaveBeenCalledWith({
      tagName: 'v3.0.0',
      sourceCommit: 'release-sha',
      message: 'v3.0.0',
    })
    expect(effects.createGitHubRelease).toHaveBeenCalledWith({
      tagName: 'v3.0.0',
      sourceCommit: 'release-sha',
      body: '## v3.0.0\n\nRelease notes.',
    })
    const tagCallOrder = effects.createAnnotatedTag.mock.invocationCallOrder[0] ?? Infinity
    const releaseCallOrder = effects.createGitHubRelease.mock.invocationCallOrder[0] ?? -Infinity
    expect(tagCallOrder).toBeLessThan(releaseCallOrder)
  })

  it('fills a missing Release behind an existing matching annotated tag', async () => {
    const effects = finalizeEffects({
      readTagState: vi.fn(async () => ({
        state: 'present',
        annotated: true,
        targetSha: 'release-sha',
      })),
    })

    await runFinalize({ request, effects })

    expect(effects.createAnnotatedTag).not.toHaveBeenCalled()
    expect(effects.createGitHubRelease).toHaveBeenCalledOnce()
  })

  it('is idempotent when tag and Release already match', async () => {
    const effects = finalizeEffects({
      readTagState: vi.fn(async () => ({
        state: 'present',
        annotated: true,
        targetSha: 'release-sha',
      })),
      readGitHubRelease: vi.fn(async () => ({
        state: 'present',
        tagName: 'v3.0.0',
      })),
    })

    await runFinalize({ request, effects })

    expect(effects.createAnnotatedTag).not.toHaveBeenCalled()
    expect(effects.createGitHubRelease).not.toHaveBeenCalled()
  })

  it.each([
    ['lightweight tag', {
      readTagState: vi.fn(async () => ({
        state: 'present',
        annotated: false,
        targetSha: 'release-sha',
      })),
    }],
    ['different tag target', {
      readTagState: vi.fn(async () => ({
        state: 'present',
        annotated: true,
        targetSha: 'other-sha',
      })),
    }],
    ['Release without tag', {
      readGitHubRelease: vi.fn(async () => ({
        state: 'present',
        tagName: 'v3.0.0',
      })),
    }],
  ])('stops without mutation for %s', async (_label, overrides) => {
    const effects = finalizeEffects(overrides)

    await expect(runFinalize({ request, effects })).rejects.toThrow()
    expect(effects.createAnnotatedTag).not.toHaveBeenCalled()
    expect(effects.createGitHubRelease).not.toHaveBeenCalled()
  })
})

describe('release artifact packing', () => {
  it('packs once and writes only the checksum beside the tarball', async () => {
    const effects = {
      ensureEmptyDirectory: vi.fn(async () => undefined),
      createArtifact: vi.fn(async () => packageArtifact),
      loadArtifact: vi.fn(async () => ({
        ...packageArtifact,
        packageContract: {
          node: '>=22.19.0',
          nuxt: '^4.1.0',
          nuxtContent: '>=3.5.0 <4.0.0',
          nuxtKit: '^4.5.2',
          mermaid: '~11.16.1',
        },
      })),
      writeFile: vi.fn(async () => undefined),
      readPackageManifest: vi.fn(async () => ({
        name: packageArtifact.packageName,
        version: packageArtifact.packageVersion,
        engines: { node: '>=22.19.0' },
        peerDependencies: {
          'nuxt': '^4.1.0',
          '@nuxt/content': '>=3.5.0 <4.0.0',
        },
        dependencies: {
          '@nuxt/kit': 'catalog:integrations',
          'mermaid': 'catalog:integrations',
        },
      })),
    }

    await expect(runPack({
      request: {
        targetVersion: '3.0.0',
        repositoryRoot: '/repo',
        artifactDirectory: '/tmp/release',
      },
      effects,
    })).resolves.toMatchObject({
      artifact: packageArtifact,
      packageContract: {
        node: '>=22.19.0',
        nuxt: '^4.1.0',
        nuxtContent: '>=3.5.0 <4.0.0',
        nuxtKit: '^4.5.2',
        mermaid: '~11.16.1',
      },
    })
    expect(effects.createArtifact).toHaveBeenCalledOnce()
    expect(effects.loadArtifact).toHaveBeenCalledWith({
      archivePath: packageArtifact.archivePath,
      checksumPath: '/tmp/release/artifact.sha512',
    })
    expect(effects.writeFile).toHaveBeenCalledWith(
      '/tmp/release/artifact.sha512',
      `${packageArtifact.integritySha512}  ${packageArtifact.filename}\n`,
    )
  })
})

describe('release workflow effects and CLI boundary', () => {
  it('parses only the declared stable command inputs', () => {
    expect(parseReleaseWorkflowArguments([
      'publish',
      '--version', '3.0.0',
      '--archive', '/tmp/release/package.tgz',
      '--checksum', '/tmp/release/artifact.sha512',
    ])).toEqual({
      command: 'publish',
      version: '3.0.0',
      archive: '/tmp/release/package.tgz',
      checksum: '/tmp/release/artifact.sha512',
    })
    expect(() => parseReleaseWorkflowArguments([
      'publish',
      '--version', '3.0.0-rc.1',
      '--archive', '/tmp/release/package.tgz',
      '--checksum', '/tmp/release/artifact.sha512',
    ])).toThrow('stable exact version')
  })

  it('publishes only the explicit tarball with lifecycle scripts disabled', async () => {
    const commandRunner = vi.fn(async () => ({}))
    const effects = createReleaseWorkflowEffects({
      repositoryRoot: '/repo',
      commandRunner,
      environment: {},
    }) as {
      publishArtifact: (input: { archivePath: string }) => Promise<void>
    }

    await effects.publishArtifact({
      archivePath: '/tmp/release/package-3.0.0.tgz',
    })

    expect(commandRunner).toHaveBeenCalledWith({
      command: 'npm',
      args: [
        'publish',
        '/tmp/release/package-3.0.0.tgz',
        '--access',
        'public',
        '--tag',
        'latest',
        '--ignore-scripts',
      ],
      cwd: '/repo',
    })
  })

  it('treats only an exact-version HTTP 404 as npm absence', async () => {
    const fetcher = vi.fn(async (url: string) => (
      url.endsWith('/3.0.0')
        ? { ok: false, status: 404, json: vi.fn() }
        : {
            ok: true,
            status: 200,
            json: vi.fn(async () => ({ version: '2.2.3' })),
          }
    ))
    const effects = createReleaseWorkflowEffects({
      repositoryRoot: '/repo',
      fetcher: fetcher as unknown as typeof fetch,
      environment: {},
    }) as {
      readNpmState: (input: {
        packageName: string
        targetVersion: string
      }) => Promise<unknown>
    }

    await expect(effects.readNpmState({
      packageName: packageArtifact.packageName,
      targetVersion: '3.0.0',
    })).resolves.toEqual(absentNpmState)
  })

  it.each([401, 500])('fails closed for npm HTTP %s', async (status) => {
    const fetcher = vi.fn(async (url: string) => (
      url.endsWith('/3.0.0')
        ? { ok: false, status, json: vi.fn() }
        : {
            ok: true,
            status: 200,
            json: vi.fn(async () => ({ version: '2.2.3' })),
          }
    ))
    const effects = createReleaseWorkflowEffects({
      repositoryRoot: '/repo',
      fetcher: fetcher as unknown as typeof fetch,
      environment: {},
    }) as {
      readNpmState: (input: {
        packageName: string
        targetVersion: string
      }) => Promise<unknown>
    }

    await expect(effects.readNpmState({
      packageName: packageArtifact.packageName,
      targetVersion: '3.0.0',
    })).rejects.toThrow(`HTTP ${status}`)
  })
})
