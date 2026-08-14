import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest'
import { verifyWebsiteArtifactIdentity } from '../scripts/website/artifact.mjs'
import type { TypeScriptProbeResult } from '../scripts/website/reference-parity.mjs'
import {
  CONFIGURATION_ACCEPTANCE,
  CONFIGURATION_INVENTORY,
  checkReferenceParity,
  discoverArtifactEvidence,
  discoverArtifactRuntimeExport,
  discoverPublicDeclarations,
  discoverRuntimeEvidence,
  DIRECT_MERMAID_CONFIG_ALLOWANCES,
  loadReferenceRecords,
  ReferenceRecordValidationFailure,
  REFERENCE_MISMATCH_CATEGORIES,
  probeDirectMermaidConfigAllowances,
  runSemanticTypeScriptProbes,
  TYPESCRIPT_PROBE_CASES,
} from '../scripts/website/reference-parity.mjs'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function artifactFixture({
  manifest,
  files,
  version = '3.0.0',
}: {
  manifest: Record<string, unknown>
  files: Record<string, string>
  version?: string
}) {
  const repositoryRoot = await mkdtemp(join(tmpdir(), 'reference-parity-'))
  temporaryDirectories.push(repositoryRoot)
  const artifactRoot = join(repositoryRoot, 'node_modules', '.pnpm', 'artifact', 'node_modules', '@barzhsieh', 'nuxt-content-mermaid')
  await mkdir(artifactRoot, { recursive: true })
  await writeFile(join(artifactRoot, 'package.json'), JSON.stringify({
    name: '@barzhsieh/nuxt-content-mermaid',
    version,
    ...manifest,
  }))
  for (const [relativePath, source] of Object.entries(files)) {
    const path = join(artifactRoot, relativePath)
    await mkdir(join(path, '..'), { recursive: true })
    await writeFile(path, source)
  }
  return {
    repositoryRoot,
    artifactRoot,
    artifact: {
      phase: 'artifact-integration',
      artifactRoot,
      manifestPath: join(artifactRoot, 'package.json'),
      packageMetadata: {
        name: '@barzhsieh/nuxt-content-mermaid',
        version,
      },
      version,
    },
  }
}

async function exactInstalledArtifact() {
  return verifyWebsiteArtifactIdentity({
    fetchRegistryMetadata: async () => ({
      name: '@barzhsieh/nuxt-content-mermaid',
      version: '3.0.0',
      dist: {
        integrity: 'sha512-kEruFkDptMGvmqS+XAB7lQS8CEaC5BAZOjJc/TINDXOFAeUlAkDDGBmAkLEI9L4XbI8jmMUlspjRel5At90v0Q==',
        tarball: 'https://registry.npmjs.org/@barzhsieh/nuxt-content-mermaid/-/nuxt-content-mermaid-3.0.0.tgz',
      },
    }),
  })
}

async function referenceRecordArtifact() {
  const { artifact } = await artifactFixture({
    manifest: { types: './dist/module.d.mts' },
    files: { 'dist/module.d.mts': 'export interface ModuleOptions {}\n' },
  })
  return artifact
}

describe('website Reference parity artifact declarations', () => {
  it('discovers an output layout through the exports types condition and follows artifact-local declarations', async () => {
    const { artifact } = await artifactFixture({
      manifest: {
        exports: { '.': { types: './types/public.d.mts' } },
        types: './ignored.d.ts',
        typesVersions: { '*': { '.': ['./also-ignored.d.ts'] } },
      },
      files: {
        'types/public.d.mts': 'export type { ModuleOptions } from \'./module.mjs\'\n',
        'types/module.d.mts': 'export interface ModuleOptions { enabled?: boolean }\n',
        'ignored.d.ts': 'export interface Wrong {}\n',
        'also-ignored.d.ts': 'export interface AlsoWrong {}\n',
      },
    })

    await expect(discoverPublicDeclarations(artifact)).resolves.toEqual({
      entry: 'types/public.d.mts',
      files: ['types/module.d.mts', 'types/public.d.mts'],
    })
  })

  it('follows package self-reference declarations through artifact exports', async () => {
    const { artifact } = await artifactFixture({
      manifest: {
        exports: {
          '.': { types: './types/public.d.mts' },
          './internal': { types: './types/internal.d.ts' },
        },
      },
      files: {
        'types/public.d.mts': 'export type { Internal } from \'@barzhsieh/nuxt-content-mermaid/internal\'\n',
        'types/internal.d.ts': 'export interface Internal { enabled: boolean }\n',
      },
    })

    await expect(discoverPublicDeclarations(artifact)).resolves.toEqual({
      entry: 'types/public.d.mts',
      files: ['types/internal.d.ts', 'types/public.d.mts'],
    })
  })

  it('creates private evidence identifiers only after artifact-relative discovery', async () => {
    const { artifact, repositoryRoot } = await artifactFixture({
      manifest: { types: './index.d.ts' },
      files: {
        'index.d.ts': 'export interface ModuleOptions {}\n',
        'dist/runtime/constants.js': 'export const DEFAULT_RUNTIME_OPTIONS = {}\n',
        'dist/runtime/false-positive.js': 'export const OTHER_OPTIONS = { DEFAULT_RUNTIME_OPTIONS: {} }\n',
      },
    })
    await mkdir(join(repositoryRoot, 'src'), { recursive: true })
    await writeFile(join(repositoryRoot, 'src', 'constants.ts'), 'export const DEFAULT_RUNTIME_OPTIONS = {}\n')

    await expect(discoverArtifactEvidence(artifact, {
      relativePath: 'dist/runtime/constants.js',
      symbolOrProbeId: 'DEFAULT_RUNTIME_OPTIONS',
      workspaceRoot: repositoryRoot,
    })).resolves.toEqual('artifact:dist/runtime/constants.js#DEFAULT_RUNTIME_OPTIONS')
    await expect(discoverArtifactEvidence(artifact, {
      relativePath: 'dist/runtime/false-positive.js',
      symbolOrProbeId: 'DEFAULT_RUNTIME_OPTIONS',
      workspaceRoot: repositoryRoot,
    })).rejects.toMatchObject({ category: 'unsupported-constraint-evidence' })
    await expect(discoverArtifactEvidence(artifact, {
      relativePath: '../../../../../../src/constants.ts',
      symbolOrProbeId: 'DEFAULT_RUNTIME_OPTIONS',
      workspaceRoot: repositoryRoot,
    })).rejects.toMatchObject({ category: 'workspace-source-evidence' })
  })

  it('discovers runtime parity seams from the verified artifact layout', async () => {
    const { artifact, repositoryRoot } = await artifactFixture({
      manifest: { types: './index.d.ts' },
      files: {
        'index.d.ts': 'export interface ModuleOptions {}\n',
        'dist/runtime/constants.js': [
          'export const DEFAULT_RUNTIME_OPTIONS = {}',
          'export const MERMAID_11_16_1_FUNCTION_CAPABILITY_PATHS = []',
          'export const MERMAID_11_16_1_REGEXP_PATHS = []',
          'export const DOMPURIFY_3_4_13_OPAQUE_CAPABILITY_PATHS = []',
        ].join('\n'),
        'dist/runtime/configuration/runtime-options.js': 'function resolveDebugDefaults() {}\n',
        'dist/runtime/configuration/module.js': 'function validateRuntimeOptions() {}\nfunction resolveModuleConfiguration() {}\n',
        'dist/runtime/configuration/core.js': 'function assertStrictData() {}\n',
        'dist/runtime/direct-mermaid-config.js': 'function assertDirectMermaidConfig() {}\n',
      },
    })

    await expect(discoverRuntimeEvidence(artifact, { workspaceRoot: repositoryRoot })).resolves.toEqual({
      literalDefaults: ['artifact:dist/runtime/constants.js#DEFAULT_RUNTIME_OPTIONS'],
      conditionalDefaults: ['artifact:dist/runtime/configuration/runtime-options.js#resolveDebugDefaults'],
      validatorsAndPrecedence: [
        'artifact:dist/runtime/configuration/module.js#resolveModuleConfiguration',
        'artifact:dist/runtime/configuration/module.js#validateRuntimeOptions',
      ],
      openPayloads: [
        'artifact:dist/runtime/configuration/core.js#assertStrictData',
        'artifact:dist/runtime/direct-mermaid-config.js#assertDirectMermaidConfig',
      ],
      directMermaidConfigAllowances: [
        'artifact:dist/runtime/constants.js#DOMPURIFY_3_4_13_OPAQUE_CAPABILITY_PATHS',
        'artifact:dist/runtime/constants.js#MERMAID_11_16_1_FUNCTION_CAPABILITY_PATHS',
        'artifact:dist/runtime/constants.js#MERMAID_11_16_1_REGEXP_PATHS',
      ],
    })
  })

  it('discovers the exact registry artifact without consulting workspace source', async () => {
    const artifact = await exactInstalledArtifact()

    expect(artifact.artifactRoot).toContain('/node_modules/.pnpm/')
    expect(artifact.packageMetadata).toMatchObject({
      name: '@barzhsieh/nuxt-content-mermaid',
      version: '3.0.0',
      exports: { '.': { types: './dist/types.d.mts' } },
    })
    await expect(probeDirectMermaidConfigAllowances(artifact)).resolves.toEqual(DIRECT_MERMAID_CONFIG_ALLOWANCES)
    await expect(discoverPublicDeclarations(artifact)).resolves.toEqual({
      entry: 'dist/types.d.mts',
      files: [
        'dist/module.d.mts',
        'dist/runtime/types/expand.d.ts',
        'dist/types.d.mts',
      ],
    })

    const declaration = await discoverPublicDeclarations(artifact)
    const shadowWorkspace = await mkdtemp(join(tmpdir(), 'reference-workspace-source-'))
    temporaryDirectories.push(shadowWorkspace)
    await mkdir(join(shadowWorkspace, 'src'), { recursive: true })
    await writeFile(join(shadowWorkspace, 'src', 'module.ts'), 'export interface WorkspaceOnly { before: true }\n')
    await writeFile(join(shadowWorkspace, 'src', 'module.ts'), 'export interface WorkspaceOnly { after: true }\n')
    await expect(discoverPublicDeclarations(artifact)).resolves.toEqual(declaration)

    const probes = await runSemanticTypeScriptProbes(artifact, declaration, {
      probes: [...TYPESCRIPT_PROBE_CASES, {
        id: 'unreadable-import-is-not-a-semantic-rejection',
        category: 'closed-configuration',
        expectation: 'reject',
        source: 'import type { Missing } from "./missing.js"\nconst value: Missing = {}',
      }],
    })
    expect(probes.slice(0, -1).filter(probe => !probe.passed)).toEqual([])
    expect(probes.at(-1)).toMatchObject({ passed: false, diagnosticCodes: [2307] })

    const runtimeExport = await discoverArtifactRuntimeExport(artifact, {
      relativePath: 'dist/runtime/configuration/module.js',
      exportName: 'resolveModuleConfiguration',
    })
    expect(runtimeExport).toMatchObject({
      evidence: 'artifact:dist/runtime/configuration/module.js#resolveModuleConfiguration',
      value: expect.any(Function),
    })
    const resolveModuleConfiguration = runtimeExport.value as (input: {
      nuxtResolvedOptions: Record<string, unknown>
      runtimeOverrides: Record<string, unknown>
    }) => { enabled: boolean, runtimeOptions: Record<string, unknown> }
    const fullRuntimeOptions = {
      debug: true,
      loader: { init: { theme: 'dark' }, lazy: { threshold: 0.5 } },
      theme: { useColorModeTheme: true, light: 'default', dark: 'dark' },
      components: { renderer: 'Renderer', spinner: 'Spinner', error: 'Error' },
      expand: {
        enabled: true,
        margin: 8,
        invokeOpenOn: { diagramClick: true },
        invokeCloseOn: { esc: true, wheel: true, swipe: true, overlayClick: true, closeButtonClick: true },
      },
      toolbar: {
        title: 'mermaid',
        fontSize: '14px',
        fullscreenToolbarScale: 1.25,
        buttons: { copy: true, fullscreen: true, expand: true },
      },
    }
    expect(resolveModuleConfiguration({
      nuxtResolvedOptions: { enabled: true, ...fullRuntimeOptions },
      runtimeOverrides: fullRuntimeOptions,
    })).toMatchObject({ enabled: true, runtimeOptions: { debug: true } })
    expect(() => resolveModuleConfiguration({
      nuxtResolvedOptions: {},
      runtimeOverrides: { enabled: true },
    })).toThrow(/contentMermaid\.enabled/)
    expect(() => resolveModuleConfiguration({
      nuxtResolvedOptions: { mermaidContent: {} },
      runtimeOverrides: {},
    })).toThrow(/mermaidContent/)
  })

  it('probes delegated payload and Direct Config constraints at discovered artifact exports', async () => {
    const artifact = await exactInstalledArtifact()
    const snapshotExport = await discoverArtifactRuntimeExport(artifact, {
      relativePath: 'dist/runtime/configuration/runtime-options.js',
      exportName: 'resolveRuntimeOptionsSnapshot',
    })
    const resolveSnapshot = snapshotExport.value as (input: Record<string, unknown>) => Record<string, unknown>
    const snapshot = resolveSnapshot({ loader: { init: { extension: { enabled: true } } } })
    expect(snapshot).toMatchObject({ loader: { init: { extension: { enabled: true } } } })

    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    class UnsupportedInstance {
      marker = true
    }
    for (const rejected of [
      { loader: { init: { extension: () => true } } },
      { loader: { init: { extension: new UnsupportedInstance() } } },
      { loader: { init: { extension: cycle } } },
      { loader: { init: { extension: undefined } } },
    ]) {
      expect(() => resolveSnapshot(rejected)).toThrow()
    }

    const directExport = await discoverArtifactRuntimeExport(artifact, {
      relativePath: 'dist/runtime/direct-mermaid-config.js',
      exportName: 'materializeDirectMermaidConfigForInvocation',
    })
    const materializeDirect = directExport.value as (input: Record<string, unknown>) => Record<string, unknown>
    const trustedPolicy = new UnsupportedInstance()
    const direct = materializeDirect({
      sequence: { actorFont: () => 'font' },
      dompurifyConfig: {
        ALLOWED_URI_REGEXP: /^https:/,
        TRUSTED_TYPES_POLICY: trustedPolicy,
      },
    })
    expect((direct.dompurifyConfig as Record<string, unknown>).TRUSTED_TYPES_POLICY).toBe(trustedPolicy)
    expect(() => materializeDirect({ flowchart: { actorFont: () => 'font' } })).toThrow()
  })

  it.each([
    [{ types: './types/index.d.ts' }, 'types/index.d.ts'],
    [{ typesVersions: { '*': { '.': ['./legacy/index.d.ts'] } } }, 'legacy/index.d.ts'],
    [{ typesVersions: {
      '<5.0': { '.': ['./legacy/index.d.ts'] },
      '>=5.0': { '.': ['./current/index.d.ts'] },
    } }, 'current/index.d.ts'],
  ])('falls back through public declaration metadata', async (manifest, expectedEntry) => {
    const { artifact } = await artifactFixture({
      manifest,
      files: { [expectedEntry]: 'export interface ModuleOptions {}\n' },
    })

    await expect(discoverPublicDeclarations(artifact)).resolves.toMatchObject({ entry: expectedEntry })
  })

  it('treats a declaration root escape as blocking verification infrastructure', async () => {
    const { artifact } = await artifactFixture({
      manifest: { types: '../outside.d.ts' },
      files: {},
    })

    await expect(discoverPublicDeclarations(artifact)).rejects.toMatchObject({ category: 'evidence-escape' })
  })
})

describe('website Reference record loader', () => {
  it('loads exactly the four explicit record kinds through one validated model', async () => {
    const artifact = await referenceRecordArtifact()
    const common = {
      artifactVersion: '3.0.0',
      description: 'Human-readable explanation.',
      evidence: ['artifact:dist/module.d.mts#ModuleOptions'],
      title: 'Reference entry',
    }
    const records = await loadReferenceRecords([
      { ...common, kind: 'configuration-group', path: 'loader', fragment: 'loader', children: ['loader.init'] },
      { ...common, kind: 'configuration-value', path: 'debug', fragment: 'debug', valueType: 'boolean' },
      { ...common, kind: 'authoring-input', path: 'authoring.frontmatter', fragment: 'frontmatter', syntax: 'frontmatter' },
      { ...common, kind: 'delegated-exception', path: 'loader.init', fragment: 'loader-init', constraint: 'strict-pure-data' },
    ], { artifactVersion: '3.0.0', artifact })

    expect(records.map(record => record.kind)).toEqual([
      'configuration-group',
      'configuration-value',
      'authoring-input',
      'delegated-exception',
    ])
  })

  it('fails closed with deterministic schema, version, evidence, path, and fragment mismatches', async () => {
    const records = [
      {
        kind: 'configuration-value',
        path: 'debug',
        fragment: 'debug',
        title: '',
        description: '',
        artifactVersion: '3.0.1',
        evidence: ['workspace:src/module.ts#ModuleOptions'],
        valueType: '',
      },
      {
        kind: 'configuration-group',
        path: 'debug',
        fragment: 'debug',
        title: 'Duplicate',
        description: 'Duplicate entry.',
        artifactVersion: '3.0.0',
        evidence: ['artifact:../src/module.ts#ModuleOptions'],
        children: [],
      },
    ]

    try {
      await loadReferenceRecords(records, { artifactVersion: '3.0.0' })
      expect.unreachable('invalid records must fail closed')
    }
    catch (error) {
      expect(error).toBeInstanceOf(ReferenceRecordValidationFailure)
      expect((error as ReferenceRecordValidationFailure).mismatches.map(mismatch => mismatch.category)).toEqual([
        'artifact-version-mismatch',
        'duplicate-fragment',
        'duplicate-path',
        'evidence-escape',
        'missing-required-prose',
        'missing-required-prose',
        'type-mismatch',
        'workspace-source-evidence',
      ])
    }
  })

  it('detaches loader output from mutable raw storage', async () => {
    const artifact = await referenceRecordArtifact()
    const evidence = ['artifact:dist/module.d.mts#ModuleOptions']
    const rawRecord = {
      kind: 'configuration-value',
      path: 'debug',
      fragment: 'debug',
      title: 'Debug',
      description: 'Debug logging.',
      artifactVersion: '3.0.0',
      evidence,
      valueType: 'boolean',
      storageOnly: { mutable: true },
    }
    const raw = [rawRecord]
    const loaded = await loadReferenceRecords(raw, { artifact })
    evidence.push('artifact:dist/module.mjs#unexpected')
    rawRecord.title = 'Changed in storage'

    const loadedRecord = loaded[0]
    expect(loadedRecord).toEqual({
      kind: 'configuration-value',
      path: 'debug',
      fragment: 'debug',
      title: 'Debug',
      description: 'Debug logging.',
      artifactVersion: '3.0.0',
      evidence: ['artifact:dist/module.d.mts#ModuleOptions'],
      valueType: 'boolean',
    })
    expect(Object.isFrozen(loadedRecord?.evidence)).toBe(true)
  })

  it('rejects a syntactically valid evidence identifier that was not discovered', async () => {
    const artifact = await referenceRecordArtifact()
    await expect(loadReferenceRecords([{
      kind: 'configuration-value',
      path: 'debug',
      fragment: 'debug',
      title: 'Debug',
      description: 'Debug logging.',
      artifactVersion: '3.0.0',
      evidence: ['artifact:dist/missing.d.mts#ModuleOptions'],
      valueType: 'boolean',
    }], { artifact })).rejects.toMatchObject({
      mismatches: [{ category: 'unreadable-verification-infrastructure' }],
    })
  })

  it('rejects records whose version differs from the verified artifact', async () => {
    const { artifact } = await artifactFixture({
      manifest: { types: './dist/module.d.mts' },
      files: { 'dist/module.d.mts': 'export interface ModuleOptions {}\n' },
      version: '3.0.1',
    })
    await expect(loadReferenceRecords([{
      kind: 'configuration-value',
      path: 'debug',
      fragment: 'debug',
      title: 'Debug',
      description: 'Debug logging.',
      artifactVersion: '3.0.0',
      evidence: ['artifact:dist/module.d.mts#ModuleOptions'],
      valueType: 'boolean',
    }], { artifact })).rejects.toMatchObject({
      mismatches: [{ category: 'artifact-version-mismatch' }],
    })
  })
})

describe('website Reference configuration inventory', () => {
  it('keeps the observed 33 package-owned group and value paths artifact-relative', () => {
    const expected = [
      'enabled',
      'debug',
      'loader',
      'loader.init',
      'loader.lazy',
      'loader.lazy.threshold',
      'theme',
      'theme.useColorModeTheme',
      'theme.light',
      'theme.dark',
      'components',
      'components.renderer',
      'components.spinner',
      'components.error',
      'expand',
      'expand.enabled',
      'expand.margin',
      'expand.invokeOpenOn',
      'expand.invokeOpenOn.diagramClick',
      'expand.invokeCloseOn',
      'expand.invokeCloseOn.esc',
      'expand.invokeCloseOn.wheel',
      'expand.invokeCloseOn.swipe',
      'expand.invokeCloseOn.overlayClick',
      'expand.invokeCloseOn.closeButtonClick',
      'toolbar',
      'toolbar.title',
      'toolbar.fontSize',
      'toolbar.fullscreenToolbarScale',
      'toolbar.buttons',
      'toolbar.buttons.copy',
      'toolbar.buttons.fullscreen',
      'toolbar.buttons.expand',
    ]

    expect(CONFIGURATION_INVENTORY).toEqual(expected)
    expect(CONFIGURATION_ACCEPTANCE).toEqual({
      contentMermaid: expected,
      runtimeConfigPublicContentMermaid: expected.slice(1),
      rejected: [
        'runtimeConfig.public.contentMermaid.enabled',
        'mermaidContent',
      ],
      deprecatedAcceptedNoOps: ['theme.useColorModeTheme'],
    })
  })
})

describe('website Reference semantic probe and checker foundation', () => {
  it('types TypeScript probe results as verification output without snippet source', () => {
    type ResultHasSource = 'source' extends keyof TypeScriptProbeResult ? true : false
    expectTypeOf<ResultHasSource>().toEqualTypeOf<false>()
  })

  it('preserves the exact Direct Mermaid Config capability paths', () => {
    expect(DIRECT_MERMAID_CONFIG_ALLOWANCES).toEqual({
      functionPaths: [
        'sequence.actorFont',
        'sequence.messageFont',
        'sequence.noteFont',
        'c4.personFont',
        'c4.external_personFont',
        'c4.systemFont',
        'c4.external_systemFont',
        'c4.system_dbFont',
        'c4.external_system_dbFont',
        'c4.system_queueFont',
        'c4.external_system_queueFont',
        'c4.containerFont',
        'c4.external_containerFont',
        'c4.container_dbFont',
        'c4.external_container_dbFont',
        'c4.container_queueFont',
        'c4.external_container_queueFont',
        'c4.componentFont',
        'c4.external_componentFont',
        'c4.component_dbFont',
        'c4.external_component_dbFont',
        'c4.component_queueFont',
        'c4.external_component_queueFont',
        'c4.boundaryFont',
        'c4.messageFont',
        'dompurifyConfig.ADD_ATTR',
        'dompurifyConfig.ADD_TAGS',
        'dompurifyConfig.CUSTOM_ELEMENT_HANDLING.attributeNameCheck',
        'dompurifyConfig.CUSTOM_ELEMENT_HANDLING.tagNameCheck',
      ],
      regexpPaths: [
        'dompurifyConfig.ALLOWED_URI_REGEXP',
        'dompurifyConfig.CUSTOM_ELEMENT_HANDLING.attributeNameCheck',
        'dompurifyConfig.CUSTOM_ELEMENT_HANDLING.tagNameCheck',
      ],
      opaqueIdentityPaths: ['dompurifyConfig.TRUSTED_TYPES_POLICY'],
    })
  })

  it('defines semantic acceptance probes without emitted type-string expectations', () => {
    expect(TYPESCRIPT_PROBE_CASES.map(({ category, expectation }) => [category, expectation])).toEqual([
      ['closed-configuration', 'accept'],
      ['closed-configuration', 'reject'],
      ['closed-configuration', 'accept'],
      ['closed-configuration', 'reject'],
      ['mermaid-component-props', 'accept'],
      ['mermaid-component-props', 'accept'],
      ['mermaid-component-props', 'reject'],
      ['mermaid-component-props', 'reject'],
      ['delegated-open-payload', 'accept'],
      ['delegated-open-payload', 'reject'],
      ['delegated-open-payload', 'reject'],
    ])
    expect(TYPESCRIPT_PROBE_CASES.every(probe => !Object.hasOwn(probe, 'emittedType'))).toBe(true)
  })

  it('reports stable mismatch categories in deterministic order from loader output only', async () => {
    expect(REFERENCE_MISMATCH_CATEGORIES).toEqual([
      'artifact-version-mismatch',
      'conditional-mismatch',
      'default-mismatch',
      'delegated-descendant',
      'deprecation-mismatch',
      'duplicate-fragment',
      'duplicate-path',
      'evidence-escape',
      'exception-mismatch',
      'extra-fragment',
      'extra-path',
      'missing-fragment',
      'missing-path',
      'missing-required-prose',
      'runtime-only-enabled',
      'snippet-failure',
      'type-mismatch',
      'unreadable-verification-infrastructure',
      'unsupported-constraint-evidence',
      'workspace-source-evidence',
    ])
    const common = {
      artifactVersion: '3.0.0',
      description: 'Reference prose.',
      evidence: ['artifact:dist/module.d.mts#ModuleOptions'],
      title: 'Reference entry',
    }
    const artifact = await exactInstalledArtifact()
    const loaded = await loadReferenceRecords([
      { ...common, kind: 'configuration-group', path: 'loader', fragment: 'loader', children: [] },
      { ...common, kind: 'configuration-value', path: 'debug', fragment: 'debug', valueType: 'boolean' },
    ], { artifactVersion: '3.0.0', artifact })

    expect(() => checkReferenceParity([...loaded] as unknown as typeof loaded, {})).toThrow(/loader output/)
    expect(await checkReferenceParity(loaded, {
      artifactVersion: '3.0.0',
      paths: ['loader', 'debug'],
      fragments: ['loader', 'debug'],
      runtimePaths: [],
    })).toEqual([{ category: 'unreadable-verification-infrastructure' }])
    expect((await checkReferenceParity(loaded, {
      artifactVersion: '3.0.1',
      paths: ['debug', 'debug', 'unknown'],
      fragments: ['debug', 'debug', 'unknown'],
      runtimePaths: ['enabled'],
      checks: {
        types: 'mismatch',
        defaults: 'match',
        conditionalDefaults: 'match',
        delegatedDescendants: 'match',
        exceptions: 'match',
        deprecations: 'match',
        constraintEvidence: 'match',
        snippets: 'mismatch',
      },
    })).map(mismatch => mismatch.category)).toEqual([
      'artifact-version-mismatch',
      'duplicate-fragment',
      'duplicate-path',
      'extra-fragment',
      'extra-path',
      'missing-fragment',
      'missing-path',
      'runtime-only-enabled',
      'snippet-failure',
      'type-mismatch',
    ])
  })

  it('fails closed when the verified artifact accepts an unrecorded configuration path', async () => {
    const exactArtifact = await exactInstalledArtifact()
    const validatorPath = 'dist/runtime/configuration/module.js'
    const validatorSource = await readFile(join(exactArtifact.artifactRoot, validatorPath), 'utf8')
    const moduleKeysPrefix = 'const MODULE_OPTION_KEYS = /* @__PURE__ */ new Set([\n'
    expect(validatorSource).toContain(moduleKeysPrefix)
    const { artifact } = await artifactFixture({
      manifest: { types: './dist/module.d.mts' },
      files: {
        'dist/module.d.mts': 'export interface RuntimeOptions {}\nexport interface ModuleOptions extends RuntimeOptions {}\n',
        [validatorPath]: validatorSource.replace(moduleKeysPrefix, `${moduleKeysPrefix}  "future",\n`),
      },
    })
    const common = {
      artifactVersion: '3.0.0',
      description: 'Reference prose.',
      evidence: ['artifact:dist/module.d.mts#ModuleOptions'],
      title: 'Reference entry',
    }
    const loaded = await loadReferenceRecords([
      { ...common, kind: 'configuration-group', path: 'loader', fragment: 'loader', children: [] },
      { ...common, kind: 'configuration-value', path: 'debug', fragment: 'debug', valueType: 'boolean' },
    ], { artifact })

    expect(await checkReferenceParity(loaded, {
      artifactVersion: '3.0.0',
      paths: ['loader', 'debug'],
      fragments: ['loader', 'debug'],
      runtimePaths: [],
      checks: Object.fromEntries(Object.keys({
        types: true,
        defaults: true,
        conditionalDefaults: true,
        delegatedDescendants: true,
        exceptions: true,
        deprecations: true,
        constraintEvidence: true,
        snippets: true,
      }).map(key => [key, 'match'])),
    })).toContainEqual({ category: 'extra-path', path: 'future' })
  })

  it('fails closed when the public artifact declaration exposes an unrecorded path', async () => {
    const exactArtifact = await exactInstalledArtifact()
    const validatorPath = 'dist/runtime/configuration/module.js'
    const validatorSource = await readFile(join(exactArtifact.artifactRoot, validatorPath), 'utf8')
    const { artifact } = await artifactFixture({
      manifest: { types: './dist/module.d.mts' },
      files: {
        'dist/module.d.mts': [
          'export interface RuntimeOptions { future?: boolean }',
          'export interface ModuleOptions extends RuntimeOptions { enabled?: boolean }',
        ].join('\n'),
        [validatorPath]: validatorSource,
      },
    })
    const loaded = await loadReferenceRecords([{
      kind: 'configuration-value',
      path: 'debug',
      fragment: 'debug',
      title: 'Debug',
      description: 'Reference prose.',
      artifactVersion: '3.0.0',
      evidence: ['artifact:dist/module.d.mts#ModuleOptions'],
      valueType: 'boolean',
    }], { artifact })

    expect(await checkReferenceParity(loaded, {
      artifactVersion: '3.0.0',
      paths: ['debug'],
      fragments: ['debug'],
      runtimePaths: [],
      checks: {
        types: 'match',
        defaults: 'match',
        conditionalDefaults: 'match',
        delegatedDescendants: 'match',
        exceptions: 'match',
        deprecations: 'match',
        constraintEvidence: 'match',
        snippets: 'match',
      },
    })).toContainEqual({ category: 'extra-path', path: 'future' })
  })
})
