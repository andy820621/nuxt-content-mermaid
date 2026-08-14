import { isDeepStrictEqual } from 'node:util'
import { writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createReleaseVerificationOperations } from '../release-verification/operations.mjs'
import { ReleaseVerificationInfrastructureError } from '../release-verification/failure-classification.mjs'
import { selectVersionProfile } from '../release-verification/profiles.mjs'
import { verifyWebsiteArtifactIdentity } from './artifact.mjs'
import { loadWebsiteReferenceCorpus } from './reference-corpus.mjs'
import {
  checkReferenceParity,
  CONFIGURATION_ACCEPTANCE,
  CONFIGURATION_INVENTORY,
  discoverArtifactRuntimeExport,
  discoverPublicDeclarations,
  probeDirectMermaidConfigAllowances,
  runSemanticTypeScriptProbes,
} from './reference-parity.mjs'

const AUTHORING_PATHS = Object.freeze([
  'authoring.component.code',
  'authoring.markdown.fence',
  'authoring.markdown.fence.title',
  'authoring.markdown.fence.display-mode',
])

export const DELEGATED_EXCEPTION_PATHS = Object.freeze([
  'delegated.loader-init',
  'delegated.component-page-config',
  'delegated.markdown-page-config',
  'delegated.markdown-diagram-config',
  'delegated.component-direct-config',
  'delegated.markdown-frontmatter-other',
])

const EXPECTED_PATHS = Object.freeze([
  ...CONFIGURATION_INVENTORY,
  ...AUTHORING_PATHS,
  ...DELEGATED_EXCEPTION_PATHS,
])

const EXPECTED_FRAGMENTS = Object.freeze([
  'enabled', 'debug', 'loader', 'loader-init', 'loader-lazy', 'loader-lazy-threshold',
  'theme', 'theme-use-color-mode-theme', 'theme-light', 'theme-dark', 'components',
  'components-renderer', 'components-spinner', 'components-error', 'expand', 'expand-enabled',
  'expand-margin', 'expand-invoke-open-on', 'expand-open-diagram-click', 'expand-invoke-close-on',
  'expand-close-esc', 'expand-close-wheel', 'expand-close-swipe', 'expand-close-overlay-click',
  'expand-close-button-click', 'toolbar', 'toolbar-title', 'toolbar-font-size',
  'toolbar-fullscreen-scale', 'toolbar-buttons', 'toolbar-button-copy', 'toolbar-button-fullscreen',
  'toolbar-button-expand', 'authoring-component-code', 'authoring-markdown-fence',
  'authoring-fence-title', 'authoring-fence-display-mode', 'delegated-loader-init',
  'delegated-component-page-config', 'delegated-markdown-page-config',
  'delegated-markdown-diagram-config', 'delegated-component-direct-config',
  'delegated-markdown-frontmatter-other',
])

const EVIDENCE = Object.freeze({
  moduleOptions: 'artifact:dist/module.d.mts#ModuleOptions',
  runtimeOptions: 'artifact:dist/module.d.mts#RuntimeOptions',
  componentProps: 'artifact:dist/module.d.mts#MermaidComponentProps',
  resolveModule: 'artifact:dist/runtime/configuration/module.js#resolveModuleConfiguration',
  validateRuntime: 'artifact:dist/runtime/configuration/module.js#validateRuntimeOptions',
  resolveExpand: 'artifact:dist/runtime/configuration/module.js#resolveExpandOptions',
  resolveToolbar: 'artifact:dist/runtime/configuration/module.js#resolveToolbarOptions',
  strictData: 'artifact:dist/runtime/configuration/core.js#assertStrictData',
  debugDefaults: 'artifact:dist/runtime/configuration/runtime-options.js#resolveDebugDefaults',
  defaultMermaid: 'artifact:dist/runtime/constants.js#DEFAULT_MERMAID_CONFIG',
  defaultLightTheme: 'artifact:dist/runtime/constants.js#DEFAULT_LIGHT_THEME',
  defaultDarkTheme: 'artifact:dist/runtime/constants.js#DEFAULT_DARK_THEME',
  defaultExpand: 'artifact:dist/runtime/constants.js#DEFAULT_EXPAND_OPTIONS',
  defaultToolbar: 'artifact:dist/runtime/constants.js#DEFAULT_TOOLBAR_OPTIONS',
  markdownToolbar: 'artifact:dist/module.mjs#resolveMarkdownToolbar',
  transformMarkdown: 'artifact:dist/module.mjs#transformMarkdownDiagrams',
  fenceAttributes: 'artifact:dist/module.mjs#resolveFenceInlineAttributes',
  componentSource: 'artifact:dist/runtime/component-configuration.js#resolveMermaidComponentSource',
  diagramConfig: 'artifact:dist/module.mjs#resolveDiagramMermaidConfig',
  markdownFrontmatter: 'artifact:dist/module.mjs#resolveMarkdownFrontmatter',
  directConfig: 'artifact:dist/runtime/direct-mermaid-config.js#assertDirectMermaidConfig',
  functionPaths: 'artifact:dist/runtime/constants.js#MERMAID_11_16_1_FUNCTION_CAPABILITY_PATHS',
  regexpPaths: 'artifact:dist/runtime/constants.js#MERMAID_11_16_1_REGEXP_PATHS',
  opaquePaths: 'artifact:dist/runtime/constants.js#DOMPURIFY_3_4_13_OPAQUE_CAPABILITY_PATHS',
})

const EXPECTED_EVIDENCE = Object.freeze({
  'enabled': { record: [EVIDENCE.moduleOptions, EVIDENCE.resolveModule], supported: [EVIDENCE.resolveModule] },
  'debug': { record: [EVIDENCE.runtimeOptions, EVIDENCE.debugDefaults], supported: [EVIDENCE.debugDefaults] },
  'loader': { record: [EVIDENCE.runtimeOptions, EVIDENCE.validateRuntime], supported: [] },
  'loader.init': { record: [EVIDENCE.defaultMermaid, EVIDENCE.debugDefaults, EVIDENCE.strictData], supported: [] },
  'loader.lazy': { record: [EVIDENCE.runtimeOptions, EVIDENCE.validateRuntime], supported: [] },
  'loader.lazy.threshold': { record: [EVIDENCE.runtimeOptions, EVIDENCE.validateRuntime], supported: [EVIDENCE.strictData, EVIDENCE.validateRuntime] },
  'theme': { record: [EVIDENCE.runtimeOptions, EVIDENCE.validateRuntime], supported: [] },
  'theme.useColorModeTheme': { record: [EVIDENCE.runtimeOptions, EVIDENCE.validateRuntime], supported: [EVIDENCE.validateRuntime] },
  'theme.light': { record: [EVIDENCE.runtimeOptions, EVIDENCE.defaultLightTheme], supported: [EVIDENCE.validateRuntime] },
  'theme.dark': { record: [EVIDENCE.runtimeOptions, EVIDENCE.defaultDarkTheme], supported: [EVIDENCE.validateRuntime] },
  'components': { record: [EVIDENCE.runtimeOptions, EVIDENCE.validateRuntime], supported: [] },
  'components.renderer': { record: [EVIDENCE.runtimeOptions, EVIDENCE.validateRuntime], supported: [EVIDENCE.validateRuntime] },
  'components.spinner': { record: [EVIDENCE.runtimeOptions, EVIDENCE.validateRuntime], supported: [EVIDENCE.validateRuntime] },
  'components.error': { record: [EVIDENCE.runtimeOptions, EVIDENCE.validateRuntime], supported: [EVIDENCE.validateRuntime] },
  'expand': { record: [EVIDENCE.defaultExpand, EVIDENCE.resolveExpand], supported: [] },
  'expand.enabled': { record: [EVIDENCE.defaultExpand, EVIDENCE.validateRuntime], supported: [EVIDENCE.validateRuntime] },
  'expand.margin': { record: [EVIDENCE.defaultExpand, EVIDENCE.validateRuntime], supported: [EVIDENCE.strictData, EVIDENCE.validateRuntime] },
  'expand.invokeOpenOn': { record: [EVIDENCE.defaultExpand, EVIDENCE.validateRuntime], supported: [] },
  'expand.invokeOpenOn.diagramClick': { record: [EVIDENCE.defaultExpand, EVIDENCE.validateRuntime], supported: [EVIDENCE.validateRuntime] },
  'expand.invokeCloseOn': { record: [EVIDENCE.defaultExpand, EVIDENCE.validateRuntime], supported: [] },
  'expand.invokeCloseOn.esc': { record: [EVIDENCE.defaultExpand, EVIDENCE.validateRuntime], supported: [EVIDENCE.validateRuntime] },
  'expand.invokeCloseOn.wheel': { record: [EVIDENCE.defaultExpand, EVIDENCE.validateRuntime], supported: [EVIDENCE.validateRuntime] },
  'expand.invokeCloseOn.swipe': { record: [EVIDENCE.defaultExpand, EVIDENCE.validateRuntime], supported: [EVIDENCE.validateRuntime] },
  'expand.invokeCloseOn.overlayClick': { record: [EVIDENCE.defaultExpand, EVIDENCE.validateRuntime], supported: [EVIDENCE.validateRuntime] },
  'expand.invokeCloseOn.closeButtonClick': { record: [EVIDENCE.defaultExpand, EVIDENCE.validateRuntime], supported: [EVIDENCE.validateRuntime] },
  'toolbar': { record: [EVIDENCE.defaultToolbar, EVIDENCE.resolveToolbar, EVIDENCE.markdownToolbar], supported: [] },
  'toolbar.title': { record: [EVIDENCE.runtimeOptions, EVIDENCE.defaultToolbar, EVIDENCE.markdownToolbar], supported: [EVIDENCE.validateRuntime, EVIDENCE.markdownToolbar] },
  'toolbar.fontSize': { record: [EVIDENCE.runtimeOptions, EVIDENCE.defaultToolbar, EVIDENCE.markdownToolbar], supported: [EVIDENCE.strictData, EVIDENCE.validateRuntime] },
  'toolbar.fullscreenToolbarScale': { record: [EVIDENCE.runtimeOptions, EVIDENCE.defaultToolbar, EVIDENCE.markdownToolbar], supported: [EVIDENCE.strictData, EVIDENCE.validateRuntime] },
  'toolbar.buttons': { record: [EVIDENCE.defaultToolbar, EVIDENCE.validateRuntime, EVIDENCE.markdownToolbar], supported: [] },
  'toolbar.buttons.copy': { record: [EVIDENCE.defaultToolbar, EVIDENCE.validateRuntime, EVIDENCE.markdownToolbar], supported: [EVIDENCE.validateRuntime] },
  'toolbar.buttons.fullscreen': { record: [EVIDENCE.defaultToolbar, EVIDENCE.validateRuntime, EVIDENCE.markdownToolbar], supported: [EVIDENCE.validateRuntime] },
  'toolbar.buttons.expand': { record: [EVIDENCE.defaultToolbar, EVIDENCE.validateRuntime, EVIDENCE.markdownToolbar], supported: [EVIDENCE.validateRuntime] },
  'authoring.component.code': { record: [EVIDENCE.componentProps], supported: [] },
  'authoring.markdown.fence': { record: [EVIDENCE.transformMarkdown], supported: [] },
  'authoring.markdown.fence.title': { record: [EVIDENCE.fenceAttributes, EVIDENCE.transformMarkdown], supported: [] },
  'authoring.markdown.fence.display-mode': { record: [EVIDENCE.fenceAttributes, EVIDENCE.transformMarkdown], supported: [] },
  'delegated.loader-init': { record: [EVIDENCE.strictData, EVIDENCE.debugDefaults], supported: [] },
  'delegated.component-page-config': { record: [EVIDENCE.componentSource, EVIDENCE.strictData], supported: [] },
  'delegated.markdown-page-config': { record: [EVIDENCE.transformMarkdown, EVIDENCE.componentSource], supported: [] },
  'delegated.markdown-diagram-config': { record: [EVIDENCE.diagramConfig, EVIDENCE.markdownFrontmatter], supported: [] },
  'delegated.component-direct-config': { record: [EVIDENCE.directConfig, EVIDENCE.functionPaths, EVIDENCE.regexpPaths, EVIDENCE.opaquePaths], supported: [] },
  'delegated.markdown-frontmatter-other': { record: [EVIDENCE.markdownFrontmatter, EVIDENCE.transformMarkdown], supported: [] },
})

const EXPECTED_VALUE_TYPES = Object.freeze({
  'enabled': 'boolean',
  'debug': 'boolean',
  'loader.lazy.threshold': 'number',
  'theme.useColorModeTheme': 'boolean',
  'theme.light': `MermaidConfig['theme']`,
  'theme.dark': `MermaidConfig['theme']`,
  'components.renderer': 'string',
  'components.spinner': 'string',
  'components.error': 'string',
  'expand.enabled': 'boolean',
  'expand.margin': 'number',
  'expand.invokeOpenOn.diagramClick': 'boolean',
  'expand.invokeCloseOn.esc': 'boolean',
  'expand.invokeCloseOn.wheel': 'boolean',
  'expand.invokeCloseOn.swipe': 'boolean',
  'expand.invokeCloseOn.overlayClick': 'boolean',
  'expand.invokeCloseOn.closeButtonClick': 'boolean',
  'toolbar.title': 'string',
  'toolbar.fontSize': 'string | number',
  'toolbar.fullscreenToolbarScale': 'number',
  'toolbar.buttons.copy': 'boolean',
  'toolbar.buttons.fullscreen': 'boolean',
  'toolbar.buttons.expand': 'boolean',
})

const LITERAL_DEFAULT_PATHS = Object.freeze([
  'enabled', 'debug', 'loader.lazy', 'theme.light', 'theme.dark', 'expand.enabled',
  'expand.margin', 'expand.invokeOpenOn.diagramClick', 'expand.invokeCloseOn.esc',
  'expand.invokeCloseOn.wheel', 'expand.invokeCloseOn.swipe',
  'expand.invokeCloseOn.overlayClick', 'expand.invokeCloseOn.closeButtonClick',
  'toolbar.title', 'toolbar.fontSize', 'toolbar.fullscreenToolbarScale',
  'toolbar.buttons.copy', 'toolbar.buttons.fullscreen', 'toolbar.buttons.expand',
])

const EXPECTED_DEFAULTS = Object.freeze({
  'enabled': { kind: 'literal', value: true },
  'debug': { kind: 'literal', value: false },
  'loader': null,
  'loader.init': {
    kind: 'conditional',
    value: {
      startOnLoad: false,
      theme: 'default',
      fontFamily: 'Arial, sans-serif, 微軟正黑體',
      securityLevel: 'strict',
    },
    outcomes: {
      'debug:false': { logLevel: 5, suppressErrorRendering: true },
      'debug:true': { logLevel: 1, suppressErrorRendering: false },
    },
  },
  'loader.lazy': { kind: 'literal', value: true },
  'loader.lazy.threshold': { kind: 'omitted' },
  'theme': null,
  'theme.useColorModeTheme': { kind: 'omitted' },
  'theme.light': { kind: 'literal', value: 'default' },
  'theme.dark': { kind: 'literal', value: 'dark' },
  'components': null,
  'components.renderer': { kind: 'omitted' },
  'components.spinner': { kind: 'omitted' },
  'components.error': { kind: 'omitted' },
  'expand': { kind: 'literal', value: true },
  'expand.enabled': { kind: 'literal', value: true },
  'expand.margin': { kind: 'literal', value: 0 },
  'expand.invokeOpenOn': null,
  'expand.invokeOpenOn.diagramClick': { kind: 'literal', value: true },
  'expand.invokeCloseOn': null,
  'expand.invokeCloseOn.esc': { kind: 'literal', value: true },
  'expand.invokeCloseOn.wheel': { kind: 'literal', value: true },
  'expand.invokeCloseOn.swipe': { kind: 'literal', value: true },
  'expand.invokeCloseOn.overlayClick': { kind: 'literal', value: true },
  'expand.invokeCloseOn.closeButtonClick': { kind: 'literal', value: true },
  'toolbar': null,
  'toolbar.title': { kind: 'literal', value: 'mermaid' },
  'toolbar.fontSize': { kind: 'literal', value: '14px' },
  'toolbar.fullscreenToolbarScale': { kind: 'literal', value: 1.25 },
  'toolbar.buttons': null,
  'toolbar.buttons.copy': { kind: 'literal', value: true },
  'toolbar.buttons.fullscreen': { kind: 'literal', value: true },
  'toolbar.buttons.expand': { kind: 'literal', value: true },
})

const EXPECTED_CHILDREN = Object.freeze({
  'loader': ['loader.init', 'loader.lazy'],
  'loader.init': [],
  'loader.lazy': ['loader.lazy.threshold'],
  'theme': ['theme.useColorModeTheme', 'theme.light', 'theme.dark'],
  'components': ['components.renderer', 'components.spinner', 'components.error'],
  'expand': ['expand.enabled', 'expand.margin', 'expand.invokeOpenOn', 'expand.invokeCloseOn'],
  'expand.invokeOpenOn': ['expand.invokeOpenOn.diagramClick'],
  'expand.invokeCloseOn': [
    'expand.invokeCloseOn.esc',
    'expand.invokeCloseOn.wheel',
    'expand.invokeCloseOn.swipe',
    'expand.invokeCloseOn.overlayClick',
    'expand.invokeCloseOn.closeButtonClick',
  ],
  'toolbar': ['toolbar.title', 'toolbar.fontSize', 'toolbar.fullscreenToolbarScale', 'toolbar.buttons'],
  'toolbar.buttons': ['toolbar.buttons.copy', 'toolbar.buttons.fullscreen', 'toolbar.buttons.expand'],
})

const CONFIGURATION_PRECEDENCE_OVERRIDES = Object.freeze({
  'loader': {
    module: 'Runtime override wins by property presence.',
    runtime: 'Overrides module options by property presence.',
  },
  'loader.init': {
    module: 'Runtime values override module values and defaults.',
    runtime: 'Highest application-level layer.',
  },
  'expand': {
    module: 'Runtime override wins by property presence.',
    runtime: 'Overrides module options by property presence.',
  },
  'theme.useColorModeTheme': {
    module: 'No layer changes behavior.',
    runtime: 'No layer changes behavior.',
  },
})

const EXPECTED_NON_CONFIGURATION_OCCURRENCES = Object.freeze({
  'authoring.component.code': [{
    surface: 'Mermaid component',
    path: '<Mermaid>.code',
    scope: 'diagram',
    precedence: 'The explicit prop supplies component source.',
  }],
  'authoring.markdown.fence': [{
    surface: 'Nuxt Content Markdown',
    path: 'Mermaid fence body',
    scope: 'diagram',
    precedence: 'Fence inline metadata overrides Mermaid YAML frontmatter.',
  }],
  'authoring.markdown.fence.title': [{
    surface: 'Mermaid fence',
    path: 'Mermaid fence title',
    scope: 'diagram',
    precedence: 'Overrides a same-named Mermaid YAML frontmatter key.',
  }],
  'authoring.markdown.fence.display-mode': [{
    surface: 'Mermaid fence',
    path: 'Mermaid fence displayMode',
    scope: 'diagram',
    precedence: 'Overrides a same-named Mermaid YAML frontmatter key.',
  }],
  'delegated.loader-init': [
    {
      surface: 'Nuxt module options',
      path: 'contentMermaid.loader.init.*',
      scope: 'application',
      precedence: 'Runtime descendants override module descendants.',
    },
    {
      surface: 'Public runtime config',
      path: 'runtimeConfig.public.contentMermaid.loader.init.*',
      scope: 'runtime',
      precedence: 'Overrides module descendants.',
    },
  ],
  'delegated.component-page-config': [{
    surface: 'Mermaid component',
    path: '<Mermaid>.pageConfig.*',
    scope: 'diagram',
    precedence: 'Overrides runtime configuration and cannot coexist with <Mermaid>.config.',
  }],
  'delegated.markdown-page-config': [{
    surface: 'Markdown page frontmatter',
    path: 'config.*',
    scope: 'page',
    precedence: 'Per-diagram Mermaid YAML and fence data override page data.',
  }],
  'delegated.markdown-diagram-config': [
    {
      surface: 'Mermaid fence',
      path: 'Mermaid fence config.*',
      scope: 'diagram',
      precedence: 'Overrides YAML config descendants.',
    },
    {
      surface: 'Mermaid YAML frontmatter',
      path: 'Mermaid YAML frontmatter config.*',
      scope: 'diagram',
      precedence: 'Fence config overrides it.',
    },
  ],
  'delegated.component-direct-config': [{
    surface: 'Mermaid component',
    path: '<Mermaid>.config.*',
    scope: 'diagram',
    precedence: 'Overrides runtime configuration and cannot coexist with pageConfig.',
  }],
  'delegated.markdown-frontmatter-other': [{
    surface: 'Mermaid YAML frontmatter',
    path: 'Mermaid YAML frontmatter other keys',
    scope: 'diagram',
    precedence: 'Fence inline title, displayMode, config, and toolbar override same-named YAML data.',
  }],
})

const EMPTY_ALLOWANCES = Object.freeze({
  functionPaths: [],
  regexpPaths: [],
  opaqueIdentityPaths: [],
})

const EXPECTED_EXCEPTION_SEMANTICS = Object.freeze({
  'delegated.loader-init': {
    delegatedOwner: 'Mermaid owns unknown descendant names and downstream meaning.',
    transportRestrictions: [
      'Plain objects and arrays only.',
      'Reject functions, class instances, cycles, explicit undefined, symbols, bigint, non-finite numbers, accessors, unsafe keys, and upstream any escapes.',
    ],
    packageFields: {
      set: ['startOnLoad', 'theme', 'fontFamily', 'securityLevel', 'logLevel', 'suppressErrorRendering'],
      read: ['theme', 'logLevel', 'suppressErrorRendering'],
    },
    unknownKeyPolicy: 'Preserve unknown strict pure-data keys for Mermaid.',
    allowances: EMPTY_ALLOWANCES,
    exclusions: ['functions', 'class instances', 'cycles', 'explicit undefined', 'upstream any escape'],
    packageBehavior: 'Supplies startOnLoad false, theme default, Arial/sans-serif/微軟正黑體 fontFamily, strict securityLevel, and debug-derived logLevel/suppressErrorRendering unless explicitly overridden.',
  },
  'delegated.component-page-config': {
    delegatedOwner: 'Mermaid owns unknown descendant meaning.',
    transportRestrictions: [
      'Plain object required.',
      'Reject functions, class instances, cycles, explicit undefined, and upstream any escapes.',
    ],
    packageFields: { set: [], read: ['theme', 'logLevel', 'suppressErrorRendering'] },
    unknownKeyPolicy: 'Preserve unknown strict pure-data keys.',
    allowances: EMPTY_ALLOWANCES,
    exclusions: ['functions', 'class instances', 'cycles', 'explicit undefined', 'simultaneous direct config'],
    packageBehavior: 'Validates transport and theme/logLevel/suppressErrorRendering types; supplies no pageConfig default.',
  },
  'delegated.markdown-page-config': {
    delegatedOwner: 'Mermaid owns unknown descendant meaning.',
    transportRestrictions: [
      'Content transport must produce a plain strict pure-data object.',
      'Reject functions, class instances, cycles, explicit undefined, and upstream any escapes.',
    ],
    packageFields: { set: [], read: ['theme', 'logLevel', 'suppressErrorRendering'] },
    unknownKeyPolicy: 'Preserve unknown strict pure-data keys.',
    allowances: EMPTY_ALLOWANCES,
    exclusions: ['functions', 'class instances', 'cycles', 'explicit undefined'],
    packageBehavior: 'Binds page config to generated transport components, validates interpreted fields, and supplies no page-level default.',
  },
  'delegated.markdown-diagram-config': {
    delegatedOwner: 'Mermaid owns descendant names and downstream meaning.',
    transportRestrictions: [
      'Plain strict pure-data record required.',
      'Reject unsafe keys, functions, class instances, cycles, explicit undefined, and upstream any escapes.',
    ],
    packageFields: { set: [], read: [] },
    unknownKeyPolicy: 'Preserve unknown strict pure-data keys while merging by property presence.',
    allowances: EMPTY_ALLOWANCES,
    exclusions: ['functions', 'class instances', 'cycles', 'explicit undefined', 'unsafe keys'],
    packageBehavior: 'Validates and merges transport data but supplies no fictitious per-diagram config default.',
  },
  'delegated.component-direct-config': {
    delegatedOwner: 'Mermaid owns configuration meaning; DOMPurify owns nested policy meaning.',
    transportRestrictions: [
      'Structural data must be plain, enumerable, string-keyed, and acyclic.',
      'Functions, RegExp, and opaque identity are accepted only at exact listed paths.',
    ],
    packageFields: { set: [], read: [] },
    unknownKeyPolicy: 'Preserve unknown structural keys that satisfy Direct Config validation.',
    exclusions: ['unlisted functions', 'unlisted RegExp', 'unlisted class instances', 'cycles', 'symbol-keyed data', 'simultaneous pageConfig'],
    packageBehavior: 'Validates exact capability paths, clones structural values and RegExp, and preserves listed functions and TRUSTED_TYPES_POLICY identity; supplies no direct-config default.',
  },
  'delegated.markdown-frontmatter-other': {
    delegatedOwner: 'Mermaid owns names, defaults, validation, and downstream meaning.',
    transportRestrictions: [
      'YAML must normalize to a plain strict pure-data record.',
      'Reject unsafe keys, functions, class instances, cycles, and explicit undefined.',
    ],
    packageFields: { set: ['title', 'displayMode', 'config', 'toolbar'], read: ['toolbar'] },
    unknownKeyPolicy: 'Preserve other strict pure-data frontmatter keys for Mermaid.',
    allowances: EMPTY_ALLOWANCES,
    exclusions: ['functions', 'class instances', 'cycles', 'explicit undefined', 'unsafe keys', 'Mermaid %%{init}%% syntax from package inventory'],
    packageBehavior: 'Parses, safely merges, and reserializes frontmatter but assigns no defaults or reset semantics to Mermaid-owned keys.',
  },
})

const NEGATIVE_TYPESCRIPT_SNIPPETS = Object.freeze([
  {
    id: 'snippet-closed-module-option',
    category: 'closed-configuration',
    expectation: 'accept',
    source: 'const options: ModuleOptions = {\n  // @ts-expect-error package options are closed\n  future: true,\n}',
  },
  {
    id: 'snippet-runtime-enabled',
    category: 'closed-configuration',
    expectation: 'accept',
    source: 'const options: RuntimeOptions = {\n  // @ts-expect-error enabled is build-time only\n  enabled: true,\n}',
  },
  {
    id: 'snippet-component-props-exclusive',
    category: 'mermaid-component-props',
    expectation: 'accept',
    source: '// @ts-expect-error pageConfig and config are mutually exclusive\nconst props: MermaidComponentProps = { pageConfig: {}, config: {} }',
  },
])

const EXPLICIT_NEGATIVES = Object.freeze([
  'runtimeConfig.public.contentMermaid.enabled is absent and rejected.',
  'mermaidContent is rejected and is not deprecated.',
  'Mermaid %%{init}%% syntax is Mermaid-owned and outside the package inventory.',
])

function valueAtPath(value, path) {
  return path.split('.').reduce((current, segment) => current?.[segment], value)
}

function typeCheckMatches(records) {
  const values = records.filter(record => record.kind === 'configuration-value')
  return values.length === Object.keys(EXPECTED_VALUE_TYPES).length
    && values.every(record => EXPECTED_VALUE_TYPES[record.path] === record.valueType)
}

function evidenceCheckMatches(records) {
  return records.length === Object.keys(EXPECTED_EVIDENCE).length
    && records.every((record) => {
      const expected = EXPECTED_EVIDENCE[record.path]
      return expected !== undefined
        && isDeepStrictEqual(record.evidence, expected.record)
        && isDeepStrictEqual(record.supportedConstraint?.evidence ?? [], expected.supported)
    })
}

function projectDefault(value) {
  if (value === undefined) return null
  if (value.kind === 'conditional') {
    return { kind: value.kind, value: value.value, outcomes: value.outcomes }
  }
  if (value.kind === 'literal') return { kind: value.kind, value: value.value }
  return { kind: value.kind }
}

function defaultCheckMatches(records, moduleResolution) {
  const resolved = { enabled: moduleResolution.enabled, ...moduleResolution.runtimeOptions }
  const configuration = records.filter(record => record.kind.startsWith('configuration-'))
  const shapesMatch = configuration.length === Object.keys(EXPECTED_DEFAULTS).length
    && configuration.every(record => isDeepStrictEqual(
      projectDefault(record.default),
      EXPECTED_DEFAULTS[record.path],
    ))
  return shapesMatch && LITERAL_DEFAULT_PATHS.every((path) => {
    const record = records.find(candidate => candidate.path === path)
    return record?.default?.kind === 'literal'
      && isDeepStrictEqual(record.default.value, valueAtPath(resolved, path))
  })
}

function childrenCheckMatches(records) {
  const groups = records.filter(record => record.kind === 'configuration-group')
  return groups.length === Object.keys(EXPECTED_CHILDREN).length
    && groups.every(record => isDeepStrictEqual(record.children, EXPECTED_CHILDREN[record.path]))
}

function conditionalCheckMatches(records, debugFalse, debugTrue) {
  const declared = records.find(record => record.path === 'loader.init')?.default
  if (declared?.kind !== 'conditional') return false
  const falseInit = debugFalse.loader?.init
  const trueInit = debugTrue.loader?.init
  const literalFields = ['startOnLoad', 'theme', 'fontFamily', 'securityLevel']
  return literalFields.every(field => isDeepStrictEqual(declared.value?.[field], falseInit?.[field]))
    && isDeepStrictEqual(declared.outcomes?.['debug:false'], {
      logLevel: falseInit?.logLevel,
      suppressErrorRendering: falseInit?.suppressErrorRendering,
    })
    && isDeepStrictEqual(declared.outcomes?.['debug:true'], {
      logLevel: trueInit?.logLevel,
      suppressErrorRendering: trueInit?.suppressErrorRendering,
    })
}

function exceptionCheckMatches(records, allowances) {
  const exceptions = records.filter(record => record.kind === 'delegated-exception')
  const direct = exceptions.find(record => record.path === 'delegated.component-direct-config')
  const semanticsMatch = exceptions.every((record) => {
    const actual = {
      delegatedOwner: record.delegatedOwner,
      transportRestrictions: record.transportRestrictions,
      packageFields: record.packageFields,
      unknownKeyPolicy: record.unknownKeyPolicy,
      exclusions: record.exclusions,
      packageBehavior: record.packageBehavior,
      ...(record.path === 'delegated.component-direct-config'
        ? {}
        : { allowances: record.allowances }),
    }
    return isDeepStrictEqual(actual, EXPECTED_EXCEPTION_SEMANTICS[record.path])
  })
  return isDeepStrictEqual(exceptions.map(record => record.path), DELEGATED_EXCEPTION_PATHS)
    && semanticsMatch
    && isDeepStrictEqual(direct?.allowances, allowances)
}

function deprecationCheckMatches(records) {
  return isDeepStrictEqual(
    records.filter(record => record.deprecation.status === 'deprecated-accepted-no-op').map(record => record.path),
    CONFIGURATION_ACCEPTANCE.deprecatedAcceptedNoOps,
  )
}

function expectedConfigurationOccurrences(path) {
  if (path === 'enabled') {
    return [{
      surface: 'Nuxt module options',
      path: 'contentMermaid.enabled',
      scope: 'build',
      precedence: 'Explicit module value overrides the package default.',
    }]
  }
  if (path === 'toolbar' || path.startsWith('toolbar.')) {
    return [
      {
        surface: 'Nuxt module options',
        path: `contentMermaid.${path}`,
        scope: 'application',
        precedence: 'Runtime override wins.',
      },
      {
        surface: 'Public runtime config',
        path: `runtimeConfig.public.contentMermaid.${path}`,
        scope: 'runtime',
        precedence: 'Per-diagram authoring wins.',
      },
      {
        surface: 'Mermaid component',
        path: `<Mermaid>.${path}`,
        scope: 'diagram',
        precedence: 'Overrides application toolbar.',
      },
      {
        surface: 'Mermaid fence',
        path: `Mermaid fence ${path}`,
        scope: 'diagram',
        precedence: path === 'toolbar'
          ? 'Overrides YAML frontmatter and application toolbar.'
          : 'Overrides YAML frontmatter.',
      },
      {
        surface: 'Mermaid YAML frontmatter',
        path: `Mermaid YAML frontmatter ${path}`,
        scope: 'diagram',
        precedence: 'Fence inline toolbar overrides it.',
      },
    ]
  }
  const precedence = CONFIGURATION_PRECEDENCE_OVERRIDES[path] ?? {
    module: 'Runtime override wins.',
    runtime: 'Overrides module options.',
  }
  return [
    {
      surface: 'Nuxt module options',
      path: `contentMermaid.${path}`,
      scope: 'application',
      precedence: precedence.module,
    },
    {
      surface: 'Public runtime config',
      path: `runtimeConfig.public.contentMermaid.${path}`,
      scope: 'runtime',
      precedence: precedence.runtime,
    },
  ]
}

function occurrenceCheckMatches(records) {
  return records.length === EXPECTED_PATHS.length
    && records.every((record) => {
      const expected = record.kind.startsWith('configuration-')
        ? expectedConfigurationOccurrences(record.path)
        : EXPECTED_NON_CONFIGURATION_OCCURRENCES[record.path]
      return expected !== undefined && isDeepStrictEqual(record.occurrences, expected)
    })
}

function boundaryCheckMatches(records) {
  return !records.some(record => record.path.startsWith('loader.init.'))
    && childrenCheckMatches(records)
    && occurrenceCheckMatches(records)
    && isDeepStrictEqual(records.flatMap(record => record.explicitNegatives ?? []), EXPLICIT_NEGATIVES)
}

function snippetProbes(records) {
  const minimumExamples = records
    .filter(record => record.minimumExample?.language === 'typescript')
    .map(record => ({
      id: `minimum-${record.minimumExample.id}`,
      category: record.kind === 'authoring-input' ? 'mermaid-component-props' : 'closed-configuration',
      expectation: 'accept',
      source: record.minimumExample.source,
    }))
  return [...minimumExamples, ...NEGATIVE_TYPESCRIPT_SNIPPETS]
}

function cleanConsumerTypeScript(records) {
  const snippets = snippetProbes(records)
  return [
    `import type { MermaidComponentProps, ModuleOptions, RuntimeOptions } from '@barzhsieh/nuxt-content-mermaid'`,
    ...snippets.map(snippet => `{\n${snippet.source}\n}`),
  ].join('\n\n')
}

function cleanConsumerMarkdown(records) {
  const examples = records
    .filter(record => record.minimumExample?.language === 'markdown')
    .map(record => record.minimumExample.source)
  return ['---', 'config: {}', '---', '', '# Reference snippets', '', ...examples].join('\n\n')
}

async function runSnippetStage(stage) {
  try {
    await stage()
    return true
  }
  catch (error) {
    if (error instanceof ReleaseVerificationInfrastructureError) throw error
    return false
  }
}

export async function verifyReferenceSnippets({
  records,
  repositoryRoot,
  operations = createReleaseVerificationOperations({
    templateDirectory: join(repositoryRoot, 'test/release-verification/consumer-template'),
  }),
} = {}) {
  const workspace = await operations.createWorkspace()
  try {
    await operations.installConsumer({
      packageSource: {
        kind: 'registry',
        packageName: '@barzhsieh/nuxt-content-mermaid',
        packageVersion: '3.0.0',
      },
      consumerDirectory: workspace.consumerDirectory,
      profile: selectVersionProfile('v3-known-latest'),
    })
    await Promise.all([
      writeFile(
        join(workspace.consumerDirectory, 'type-contracts/package-user.ts'),
        `${cleanConsumerTypeScript(records)}\n`,
      ),
      writeFile(
        join(workspace.consumerDirectory, 'content/index.md'),
        `${cleanConsumerMarkdown(records)}\n`,
      ),
    ])
    const typescript = await runSnippetStage(() => operations.verifyTypes({
      consumerDirectory: workspace.consumerDirectory,
    }))
    const markdown = await runSnippetStage(() => operations.buildConsumer({
      consumerDirectory: workspace.consumerDirectory,
    }))
    return Object.freeze({ typescript, markdown })
  }
  finally {
    await operations.cleanupWorkspace(workspace.root)
  }
}

async function verifyWebsiteReferenceOrThrow({
  repositoryRoot,
  resolveArtifact = options => verifyWebsiteArtifactIdentity(options),
  loadCorpus = options => loadWebsiteReferenceCorpus(options),
  verifySnippets = options => verifyReferenceSnippets(options),
} = {}) {
  const artifact = await resolveArtifact({ repositoryRoot })
  const records = await loadCorpus({ artifact, repositoryRoot })
  const declarations = await discoverPublicDeclarations(artifact)
  const [moduleExport, snapshotExport, allowances, semanticProbes, minimumProbes, snippetResult]
    = await Promise.all([
      discoverArtifactRuntimeExport(artifact, {
        relativePath: 'dist/runtime/configuration/module.js',
        exportName: 'resolveModuleConfiguration',
        workspaceRoot: repositoryRoot,
      }),
      discoverArtifactRuntimeExport(artifact, {
        relativePath: 'dist/runtime/configuration/runtime-options.js',
        exportName: 'resolveRuntimeOptionsSnapshot',
        workspaceRoot: repositoryRoot,
      }),
      probeDirectMermaidConfigAllowances(artifact, { workspaceRoot: repositoryRoot }),
      runSemanticTypeScriptProbes(artifact, declarations),
      runSemanticTypeScriptProbes(artifact, declarations, { probes: snippetProbes(records) }),
      verifySnippets({ artifact, records, repositoryRoot }),
    ])
  const resolveModuleConfiguration = moduleExport.value
  const resolveRuntimeOptionsSnapshot = snapshotExport.value
  if (typeof resolveModuleConfiguration !== 'function' || typeof resolveRuntimeOptionsSnapshot !== 'function') {
    throw new TypeError('Reference runtime probe exports must be functions')
  }
  const moduleResolution = resolveModuleConfiguration({ nuxtResolvedOptions: {}, runtimeOverrides: {} })
  const debugFalse = resolveRuntimeOptionsSnapshot({ debug: false })
  const debugTrue = resolveRuntimeOptionsSnapshot({ debug: true })
  const typesMatch = typeCheckMatches(records) && semanticProbes.every(probe => probe.passed)
  const snippetsMatch = minimumProbes.every(probe => probe.passed)
    && snippetResult.typescript === true
    && snippetResult.markdown === true
  const mismatches = await checkReferenceParity(records, {
    artifactVersion: '3.0.0',
    paths: EXPECTED_PATHS,
    fragments: EXPECTED_FRAGMENTS,
    runtimePaths: CONFIGURATION_ACCEPTANCE.runtimeConfigPublicContentMermaid,
    checks: {
      types: typesMatch ? 'match' : 'mismatch',
      defaults: defaultCheckMatches(records, moduleResolution) ? 'match' : 'mismatch',
      conditionalDefaults: conditionalCheckMatches(records, debugFalse, debugTrue) ? 'match' : 'mismatch',
      delegatedDescendants: boundaryCheckMatches(records) ? 'match' : 'mismatch',
      exceptions: exceptionCheckMatches(records, allowances) ? 'match' : 'mismatch',
      deprecations: deprecationCheckMatches(records) ? 'match' : 'mismatch',
      constraintEvidence: evidenceCheckMatches(records) ? 'match' : 'mismatch',
      snippets: snippetsMatch ? 'match' : 'mismatch',
    },
  })
  return Object.freeze({
    artifact,
    recordCount: records.length,
    mismatches,
  })
}

export async function verifyWebsiteReference(options = {}) {
  try {
    return await verifyWebsiteReferenceOrThrow(options)
  }
  catch (error) {
    const mismatches = Array.isArray(error?.mismatches)
      ? error.mismatches
      : [{
          category: typeof error?.category === 'string'
            ? error.category
            : 'unreadable-verification-infrastructure',
        }]
    return Object.freeze({
      artifact: undefined,
      recordCount: 0,
      mismatches: Object.freeze(mismatches),
    })
  }
}

export async function runWebsiteReferenceCli({
  repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
  verifyReference = options => verifyWebsiteReference(options),
  writeOutput = value => console.log(value),
} = {}) {
  const result = await verifyReference({ repositoryRoot })
  const identity = result.artifact
    ? `${result.artifact.packageName}@${result.artifact.version}`
    : '@barzhsieh/nuxt-content-mermaid@3.0.0'
  writeOutput(JSON.stringify({
    artifact: identity,
    recordCount: result.recordCount,
    mismatches: result.mismatches,
  }, null, 2))
  return result
}

async function main() {
  const result = await runWebsiteReferenceCli()
  if (result.mismatches.length > 0) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
