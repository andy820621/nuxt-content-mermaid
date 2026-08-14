import { access, readFile, realpath } from 'node:fs/promises'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

export const CONFIGURATION_INVENTORY = Object.freeze([
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
])

export const CONFIGURATION_ACCEPTANCE = Object.freeze({
  contentMermaid: CONFIGURATION_INVENTORY,
  runtimeConfigPublicContentMermaid: Object.freeze(CONFIGURATION_INVENTORY.slice(1)),
  rejected: Object.freeze([
    'runtimeConfig.public.contentMermaid.enabled',
    'mermaidContent',
  ]),
  deprecatedAcceptedNoOps: Object.freeze(['theme.useColorModeTheme']),
})

export const REFERENCE_MISMATCH_CATEGORIES = Object.freeze([
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

export const TYPESCRIPT_PROBE_CASES = Object.freeze([
  { id: 'module-options-positive', category: 'closed-configuration', expectation: 'accept', source: 'const value: ModuleOptions = { enabled: true, debug: false }' },
  { id: 'module-options-removed-alias', category: 'closed-configuration', expectation: 'reject', source: 'const value: ModuleOptions = { mermaidContent: {} }' },
  { id: 'runtime-options-positive', category: 'closed-configuration', expectation: 'accept', source: 'const value: RuntimeOptions = { debug: false, loader: { lazy: true } }' },
  { id: 'runtime-options-enabled', category: 'closed-configuration', expectation: 'reject', source: 'const value: RuntimeOptions = { enabled: true }' },
  { id: 'component-props-page-config', category: 'mermaid-component-props', expectation: 'accept', source: 'const value: MermaidComponentProps = { pageConfig: { theme: "dark" } }' },
  { id: 'component-props-direct-config', category: 'mermaid-component-props', expectation: 'accept', source: 'const value: MermaidComponentProps = { config: { theme: "dark" } }' },
  { id: 'component-props-exclusive', category: 'mermaid-component-props', expectation: 'reject', source: 'const value: MermaidComponentProps = { pageConfig: {}, config: {} }' },
  { id: 'component-props-null-page-config', category: 'mermaid-component-props', expectation: 'reject', source: 'const value: MermaidComponentProps = { pageConfig: null }' },
  { id: 'delegated-payload-unknown-data', category: 'delegated-open-payload', expectation: 'accept', source: 'const value: RuntimeMermaidConfig = { extension: { enabled: true } }' },
  { id: 'delegated-payload-function', category: 'delegated-open-payload', expectation: 'reject', source: 'const value: RuntimeMermaidConfig = { extension: () => true }' },
  { id: 'delegated-payload-upstream-any', category: 'delegated-open-payload', expectation: 'reject', source: 'import type { MermaidConfig } from "mermaid"\ndeclare const upstreamConfig: MermaidConfig\nconst value: RuntimeMermaidConfig = upstreamConfig' },
].map(Object.freeze))

export const DIRECT_MERMAID_CONFIG_ALLOWANCES = Object.freeze({
  functionPaths: Object.freeze([
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
  ]),
  regexpPaths: Object.freeze([
    'dompurifyConfig.ALLOWED_URI_REGEXP',
    'dompurifyConfig.CUSTOM_ELEMENT_HANDLING.attributeNameCheck',
    'dompurifyConfig.CUSTOM_ELEMENT_HANDLING.tagNameCheck',
  ]),
  opaqueIdentityPaths: Object.freeze(['dompurifyConfig.TRUSTED_TYPES_POLICY']),
})

export class ReferenceVerificationInfrastructureFailure extends Error {
  constructor(category, message, options) {
    super(`reference verification infrastructure failure [${category}]: ${message}`, options)
    this.name = 'ReferenceVerificationInfrastructureFailure'
    this.category = category
  }
}

function infrastructureFailure(category, message, cause) {
  throw new ReferenceVerificationInfrastructureFailure(category, message, cause ? { cause } : undefined)
}

function isWithin(root, candidate) {
  const child = relative(root, candidate)
  return child === '' || (!child.startsWith('..') && !child.startsWith(sep))
}

async function verificationRealpath(path, label) {
  try {
    return await realpath(path)
  }
  catch (error) {
    infrastructureFailure('unreadable-verification-infrastructure', `${label} is unreadable`, error)
  }
}

function assertVerifiedArtifact(artifact) {
  if (artifact?.phase !== 'artifact-integration'
    || typeof artifact.artifactRoot !== 'string'
    || typeof artifact.manifestPath !== 'string'
    || artifact.packageMetadata?.version !== artifact.version) {
    infrastructureFailure('unreadable-verification-infrastructure', 'a verified website artifact identity is required')
  }
}

function firstString(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = firstString(item)
      if (result) return result
    }
  }
}

function exportsTypesTarget(exportsField) {
  if (!exportsField || typeof exportsField !== 'object' || Array.isArray(exportsField)) return undefined
  const rootExport = Object.hasOwn(exportsField, '.') ? exportsField['.'] : exportsField
  if (!rootExport || typeof rootExport !== 'object' || Array.isArray(rootExport)) return undefined
  if (Object.hasOwn(rootExport, 'types')) return firstString(rootExport.types)
  for (const value of Object.values(rootExport)) {
    const nested = exportsTypesTarget(value)
    if (nested) return nested
  }
}

function matchingTypesVersionMapping(typesVersions) {
  if (!typesVersions || typeof typesVersions !== 'object' || Array.isArray(typesVersions)) return undefined
  const compilerVersion = new ts.Version(ts.version)
  for (const [range, mapping] of Object.entries(typesVersions)) {
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) continue
    let matches
    try {
      matches = new ts.VersionRange(range).test(compilerVersion)
    }
    catch {
      continue
    }
    if (!matches) continue
    return mapping
  }
}

function typesVersionsTarget(typesVersions, subpath = '.') {
  const mapping = matchingTypesVersionMapping(typesVersions)
  if (!mapping) return undefined
  const directTarget = firstString(mapping[subpath])
  if (directTarget) return directTarget
  for (const [pattern, value] of Object.entries(mapping)) {
    const wildcardIndex = pattern.indexOf('*')
    if (wildcardIndex < 0) continue
    const prefix = pattern.slice(0, wildcardIndex)
    const suffix = pattern.slice(wildcardIndex + 1)
    if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) continue
    const wildcard = subpath.slice(prefix.length, subpath.length - suffix.length)
    const target = firstString(value)
    if (target) return target.replace('*', wildcard)
  }
  if (subpath === '.') return firstString(mapping['*'])
}

function declarationTarget(manifest) {
  return exportsTypesTarget(manifest.exports)
    ?? firstString(manifest.types)
    ?? typesVersionsTarget(manifest.typesVersions)
}

function selfReferenceDeclarationTarget(manifest, specifier) {
  if (specifier === manifest.name) return declarationTarget(manifest)
  const prefix = `${manifest.name}/`
  if (!specifier.startsWith(prefix)) return undefined
  const subpath = specifier.slice(prefix.length)
  const exported = manifest.exports?.[`./${subpath}`]
  return exportsTypesTarget(exported) ?? typesVersionsTarget(manifest.typesVersions, subpath)
}

async function firstExisting(candidates) {
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    }
    catch {
      // Continue through TypeScript's declaration-file extension substitutions.
    }
  }
}

async function resolveDeclarationFile(artifactRoot, importer, specifier) {
  const unresolved = resolve(dirname(importer), specifier)
  if (!isWithin(artifactRoot, unresolved)) {
    infrastructureFailure('evidence-escape', `declaration import escapes the verified artifact root: ${specifier}`)
  }
  const extension = extname(unresolved)
  const candidates = extension === '.mjs'
    ? [unresolved.replace(/\.mjs$/, '.d.mts'), unresolved]
    : extension === '.js'
      ? [unresolved.replace(/\.js$/, '.d.ts'), unresolved]
      : extension
        ? [unresolved]
        : [`${unresolved}.d.mts`, `${unresolved}.d.ts`, resolve(unresolved, 'index.d.mts'), resolve(unresolved, 'index.d.ts')]
  const found = await firstExisting(candidates)
  if (!found) infrastructureFailure('unreadable-verification-infrastructure', `could not resolve declaration import: ${specifier}`)
  let canonical
  try {
    canonical = await realpath(found)
  }
  catch (error) {
    infrastructureFailure('unreadable-verification-infrastructure', `could not read declaration: ${specifier}`, error)
  }
  if (!isWithin(artifactRoot, canonical)) {
    infrastructureFailure('evidence-escape', `declaration import resolves outside the verified artifact root: ${specifier}`)
  }
  return canonical
}

function declarationSpecifiers(source) {
  const preprocessed = ts.preProcessFile(source, true, true)
  const specifiers = new Set([
    ...preprocessed.importedFiles.map(file => file.fileName),
    ...preprocessed.referencedFiles.map(file => file.fileName),
  ])
  return [...specifiers]
}

function sourceDefinesEvidence(source, file, symbolOrProbeId) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  let discovered = false
  function isEvidenceDeclaration(node) {
    return ts.isVariableDeclaration(node)
      || ts.isFunctionDeclaration(node)
      || ts.isClassDeclaration(node)
      || ts.isInterfaceDeclaration(node)
      || ts.isTypeAliasDeclaration(node)
      || ts.isEnumDeclaration(node)
      || ts.isModuleDeclaration(node)
      || ts.isPropertyDeclaration(node)
      || ts.isPropertySignature(node)
      || ts.isMethodDeclaration(node)
      || ts.isMethodSignature(node)
      || ts.isGetAccessorDeclaration(node)
      || ts.isSetAccessorDeclaration(node)
  }
  function visit(node) {
    const name = node.name
    if (isEvidenceDeclaration(node)
      && name
      && (ts.isIdentifier(name) || ts.isStringLiteral(name))
      && name.text === symbolOrProbeId) {
      discovered = true
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  if (discovered) return true
  const escapedId = symbolOrProbeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|\\n)\\s*(?://|/\\*)\\s*reference-probe:\\s*${escapedId}(?:\\s|\\*/|$)`).test(source)
}

export async function discoverArtifactEvidence(artifact, {
  relativePath,
  symbolOrProbeId,
  workspaceRoot,
}) {
  assertVerifiedArtifact(artifact)
  if (!isNonEmptyString(relativePath) || !isNonEmptyString(symbolOrProbeId) || symbolOrProbeId.includes('#')) {
    infrastructureFailure('unsupported-constraint-evidence', 'evidence discovery requires a relative file and stable symbol or probe id')
  }
  const artifactRoot = await verificationRealpath(artifact.artifactRoot, 'verified artifact root')
  const candidate = resolve(artifactRoot, relativePath)
  if (!isWithin(artifactRoot, candidate)) {
    const canonicalWorkspaceRoot = workspaceRoot ? await verificationRealpath(workspaceRoot, 'workspace root') : undefined
    if (canonicalWorkspaceRoot && isWithin(canonicalWorkspaceRoot, candidate)) {
      infrastructureFailure('workspace-source-evidence', 'workspace source cannot be used as artifact evidence')
    }
    infrastructureFailure('evidence-escape', 'evidence path escapes the verified artifact root')
  }
  let discovered
  let source
  try {
    discovered = await realpath(candidate)
    source = await readFile(discovered, 'utf8')
  }
  catch (error) {
    infrastructureFailure('unreadable-verification-infrastructure', `evidence is unreadable: ${relativePath}`, error)
  }
  if (!isWithin(artifactRoot, discovered)) {
    infrastructureFailure('evidence-escape', 'evidence symlink escapes the verified artifact root')
  }
  if (!sourceDefinesEvidence(source, discovered, symbolOrProbeId)) {
    infrastructureFailure('unsupported-constraint-evidence', `evidence symbol or probe was not discovered: ${symbolOrProbeId}`)
  }
  const artifactPath = relative(artifactRoot, discovered).split(sep).join('/')
  return `artifact:${artifactPath}#${symbolOrProbeId}`
}

export async function discoverArtifactRuntimeExport(artifact, {
  relativePath,
  exportName,
  workspaceRoot,
}) {
  const evidence = await discoverArtifactEvidence(artifact, {
    relativePath,
    symbolOrProbeId: exportName,
    workspaceRoot,
  })
  const artifactRoot = await verificationRealpath(artifact.artifactRoot, 'verified artifact root')
  const modulePath = await verificationRealpath(resolve(artifactRoot, relativePath), 'runtime probe module')
  let module
  try {
    module = await import(pathToFileURL(modulePath).href)
  }
  catch (error) {
    infrastructureFailure('unreadable-verification-infrastructure', `runtime probe module is unreadable: ${relativePath}`, error)
  }
  if (!Object.hasOwn(module, exportName)) {
    infrastructureFailure('unsupported-constraint-evidence', `runtime probe export was not discovered: ${exportName}`)
  }
  return Object.freeze({ evidence, value: module[exportName] })
}

const RUNTIME_EVIDENCE_PROBES = Object.freeze({
  literalDefaults: Object.freeze([
    ['dist/runtime/constants.js', 'DEFAULT_RUNTIME_OPTIONS'],
  ]),
  conditionalDefaults: Object.freeze([
    ['dist/runtime/configuration/runtime-options.js', 'resolveDebugDefaults'],
  ]),
  validatorsAndPrecedence: Object.freeze([
    ['dist/runtime/configuration/module.js', 'resolveModuleConfiguration'],
    ['dist/runtime/configuration/module.js', 'validateRuntimeOptions'],
  ]),
  openPayloads: Object.freeze([
    ['dist/runtime/configuration/core.js', 'assertStrictData'],
    ['dist/runtime/direct-mermaid-config.js', 'assertDirectMermaidConfig'],
  ]),
  directMermaidConfigAllowances: Object.freeze([
    ['dist/runtime/constants.js', 'DOMPURIFY_3_4_13_OPAQUE_CAPABILITY_PATHS'],
    ['dist/runtime/constants.js', 'MERMAID_11_16_1_FUNCTION_CAPABILITY_PATHS'],
    ['dist/runtime/constants.js', 'MERMAID_11_16_1_REGEXP_PATHS'],
  ]),
})

export async function discoverRuntimeEvidence(artifact, { workspaceRoot } = {}) {
  const result = {}
  for (const [category, probes] of Object.entries(RUNTIME_EVIDENCE_PROBES)) {
    result[category] = await Promise.all(probes.map(([relativePath, symbolOrProbeId]) => (
      discoverArtifactEvidence(artifact, { relativePath, symbolOrProbeId, workspaceRoot })
    )))
  }
  return result
}

function capabilityPaths(value, exportName) {
  if (!Array.isArray(value)
    || value.some(path => !Array.isArray(path) || path.some(segment => typeof segment !== 'string'))) {
    infrastructureFailure('unreadable-verification-infrastructure', `${exportName} is not an array of artifact capability paths`)
  }
  return Object.freeze(value.map(path => path.join('.')))
}

export async function probeDirectMermaidConfigAllowances(artifact, { workspaceRoot } = {}) {
  const relativePath = 'dist/runtime/constants.js'
  const [functions, regexps, opaque] = await Promise.all([
    discoverArtifactRuntimeExport(artifact, {
      relativePath,
      exportName: 'MERMAID_11_16_1_FUNCTION_CAPABILITY_PATHS',
      workspaceRoot,
    }),
    discoverArtifactRuntimeExport(artifact, {
      relativePath,
      exportName: 'MERMAID_11_16_1_REGEXP_PATHS',
      workspaceRoot,
    }),
    discoverArtifactRuntimeExport(artifact, {
      relativePath,
      exportName: 'DOMPURIFY_3_4_13_OPAQUE_CAPABILITY_PATHS',
      workspaceRoot,
    }),
  ])
  return Object.freeze({
    functionPaths: capabilityPaths(functions.value, 'MERMAID_11_16_1_FUNCTION_CAPABILITY_PATHS'),
    regexpPaths: capabilityPaths(regexps.value, 'MERMAID_11_16_1_REGEXP_PATHS'),
    opaqueIdentityPaths: capabilityPaths(opaque.value, 'DOMPURIFY_3_4_13_OPAQUE_CAPABILITY_PATHS'),
  })
}

function createArtifactTypeScriptProgram(virtualSources) {
  const compilerOptions = {
    allowImportingTsExtensions: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ESNext,
    types: [],
  }
  const host = ts.createCompilerHost(compilerOptions)
  const getSourceFile = host.getSourceFile.bind(host)
  host.fileExists = file => virtualSources.has(file) || ts.sys.fileExists(file)
  host.readFile = file => virtualSources.get(file) ?? ts.sys.readFile(file)
  host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => (
    virtualSources.has(file)
      ? ts.createSourceFile(file, virtualSources.get(file), languageVersion, true)
      : getSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile)
  )
  return ts.createProgram([...virtualSources.keys()], compilerOptions, host)
}

export async function runSemanticTypeScriptProbes(artifact, declarations, {
  probes = TYPESCRIPT_PROBE_CASES,
} = {}) {
  assertVerifiedArtifact(artifact)
  const artifactRoot = await verificationRealpath(artifact.artifactRoot, 'verified artifact root')
  const declarationEntry = await verificationRealpath(resolve(artifactRoot, declarations.entry), 'TypeScript declaration probe')
  if (!isWithin(artifactRoot, declarationEntry)) {
    infrastructureFailure('evidence-escape', 'TypeScript declaration probe escapes the verified artifact root')
  }
  const virtualSources = new Map(probes.map(probe => [
    resolve(artifactRoot, '.reference-probes', `${probe.id}.ts`),
    [
      `import type { MermaidComponentProps, ModuleOptions, RuntimeMermaidConfig, RuntimeOptions } from ${JSON.stringify(declarationEntry)}`,
      probe.source,
    ].join('\n'),
  ]))
  const program = createArtifactTypeScriptProgram(virtualSources)
  const diagnosticsByFile = Map.groupBy(
    ts.getPreEmitDiagnostics(program).filter(diagnostic => diagnostic.file && virtualSources.has(diagnostic.file.fileName)),
    diagnostic => diagnostic.file.fileName,
  )
  // TS2322 is failed assignability and TS2353 is an excess property; any
  // other diagnostic means the probe infrastructure failed, not that the
  // artifact semantically rejected the snippet.
  const assignabilityDiagnosticCodes = new Set([2322, 2353])
  return probes.map((probe) => {
    const virtualFile = resolve(artifactRoot, '.reference-probes', `${probe.id}.ts`)
    const diagnostics = diagnosticsByFile.get(virtualFile) ?? []
    const observed = diagnostics.length === 0 ? 'accept' : 'reject'
    const semanticRejection = diagnostics.length > 0
      && diagnostics.every(diagnostic => assignabilityDiagnosticCodes.has(diagnostic.code))
    return Object.freeze({
      id: probe.id,
      category: probe.category,
      expectation: probe.expectation,
      observed,
      passed: probe.expectation === 'accept' ? diagnostics.length === 0 : semanticRejection,
      diagnosticCodes: Object.freeze(diagnostics.map(diagnostic => diagnostic.code).sort((left, right) => left - right)),
    })
  })
}

export async function discoverPublicDeclarations(artifact) {
  assertVerifiedArtifact(artifact)
  const artifactRoot = await verificationRealpath(artifact.artifactRoot, 'verified artifact root')
  const manifestPath = await verificationRealpath(artifact.manifestPath, 'artifact package metadata')
  if (!isWithin(artifactRoot, manifestPath)) {
    infrastructureFailure('evidence-escape', 'artifact manifest escapes the verified artifact root')
  }
  let manifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  }
  catch (error) {
    infrastructureFailure('unreadable-verification-infrastructure', 'artifact package metadata is unreadable', error)
  }
  if (manifest.name !== artifact.packageMetadata.name || manifest.version !== artifact.version) {
    infrastructureFailure('artifact-version-mismatch', 'artifact package metadata changed after identity verification')
  }
  const target = declarationTarget(manifest)
  if (!target) infrastructureFailure('unreadable-verification-infrastructure', 'artifact package metadata has no public declaration entry')
  const entry = await resolveDeclarationFile(artifactRoot, manifestPath, target)
  const pending = [entry]
  const discovered = new Set()
  while (pending.length > 0) {
    const file = pending.pop()
    if (discovered.has(file)) continue
    discovered.add(file)
    let source
    try {
      source = await readFile(file, 'utf8')
    }
    catch (error) {
      infrastructureFailure('unreadable-verification-infrastructure', `declaration is unreadable: ${relative(artifactRoot, file)}`, error)
    }
    for (const specifier of declarationSpecifiers(source)) {
      if (specifier.startsWith('.')) {
        pending.push(await resolveDeclarationFile(artifactRoot, file, specifier))
        continue
      }
      if (specifier === manifest.name || specifier.startsWith(`${manifest.name}/`)) {
        const target = selfReferenceDeclarationTarget(manifest, specifier)
        if (!target) infrastructureFailure('unreadable-verification-infrastructure', `could not resolve declaration self-reference: ${specifier}`)
        pending.push(await resolveDeclarationFile(artifactRoot, manifestPath, target))
      }
    }
  }
  return {
    entry: relative(artifactRoot, entry),
    files: [...discovered].map(file => relative(artifactRoot, file)).sort(),
  }
}

const REFERENCE_RECORD_KINDS = new Set([
  'configuration-group',
  'configuration-value',
  'authoring-input',
  'delegated-exception',
])
const LOADED_REFERENCE_MODELS = new WeakSet()
const LOADED_REFERENCE_ARTIFACTS = new WeakMap()
// Identity scoping prevents temp artifacts at different roots from sharing an
// observation while avoiding duplicate TypeScript programs per loaded model.
const ARTIFACT_CONFIGURATION_INVENTORIES = new WeakMap()

export class ReferenceRecordValidationFailure extends Error {
  constructor(mismatches) {
    super(`Reference record validation failed with ${mismatches.length} mismatch(es)`)
    this.name = 'ReferenceRecordValidationFailure'
    this.mismatches = mismatches
  }
}

function compareMismatch(left, right) {
  return left.category.localeCompare(right.category)
    || String(left.path ?? '').localeCompare(String(right.path ?? ''))
    || String(left.fragment ?? '').localeCompare(String(right.fragment ?? ''))
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== ''
}

function isSupportedConstraint(value) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && isNonEmptyString(value.summary)
    && Array.isArray(value.evidence)
    && value.evidence.length > 0
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString)
}

function isSummary(value, allowedKinds) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && allowedKinds.includes(value.kind)
    && isNonEmptyString(value.summary)
}

function isMinimumExample(value) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && isNonEmptyString(value.id)
    && ['typescript', 'markdown'].includes(value.language)
    && isNonEmptyString(value.source)
}

function areOccurrences(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(occurrence => occurrence
      && typeof occurrence === 'object'
      && !Array.isArray(occurrence)
      && ['surface', 'path', 'scope', 'precedence'].every(field => isNonEmptyString(occurrence[field])))
}

function isDeprecation(value) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && ['active', 'deprecated-accepted-no-op', 'rejected', 'outside-inventory'].includes(value.status)
    && isNonEmptyString(value.summary)
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isDelegatedAllowances(value) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && ['functionPaths', 'regexpPaths', 'opaqueIdentityPaths'].every(field => isStringArray(value[field]))
}

function isPackageFields(value) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && isStringArray(value.set)
    && isStringArray(value.read)
}

function cloneAndFreezeReferenceValue(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(cloneAndFreezeReferenceValue))
  if (value && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneAndFreezeReferenceValue(nested)]),
    ))
  }
  return value
}

const COMMON_HUMAN_FIELDS = Object.freeze([
  'purpose',
  'ownership',
  'occurrences',
  'scope',
  'boundary',
  'deprecation',
  'explicitNegatives',
])

const KIND_HUMAN_FIELDS = Object.freeze({
  'configuration-group': Object.freeze([
    'precedence',
    'default',
    'reset',
    'minimumExample',
    'lifecycle',
    'errorSemantics',
    'supportedConstraint',
    'recommendedRange',
    'localValidation',
  ]),
  'configuration-value': Object.freeze([
    'precedence',
    'default',
    'reset',
    'minimumExample',
    'lifecycle',
    'errorSemantics',
    'supportedConstraint',
    'recommendedRange',
    'localValidation',
  ]),
  'authoring-input': Object.freeze([
    'transportTarget',
    'sourcePrecedence',
    'downstreamOwnership',
    'minimumExample',
  ]),
  'delegated-exception': Object.freeze([
    'delegatedOwner',
    'transportRestrictions',
    'packageFields',
    'unknownKeyPolicy',
    'allowances',
    'exclusions',
    'packageBehavior',
  ]),
})

function projectHumanFields(record, loadedRecord) {
  for (const field of [...COMMON_HUMAN_FIELDS, ...KIND_HUMAN_FIELDS[record.kind]]) {
    if (Object.hasOwn(record, field)) {
      loadedRecord[field] = cloneAndFreezeReferenceValue(record[field])
    }
  }
}

async function evidenceMismatch(identifier, record, artifact, workspaceRoot) {
  if (typeof identifier !== 'string' || identifier.startsWith('workspace:')) {
    return { category: 'workspace-source-evidence', path: record.path, fragment: record.fragment }
  }
  const match = identifier.match(/^artifact:([^#]+)#([^#]+)$/)
  if (!match) return { category: 'unsupported-constraint-evidence', path: record.path, fragment: record.fragment }
  const artifactPath = match[1]
  if (artifactPath.startsWith('/') || artifactPath.split(/[\\/]/).includes('..')) {
    return { category: 'evidence-escape', path: record.path, fragment: record.fragment }
  }
  if (!artifact) return { category: 'unsupported-constraint-evidence', path: record.path, fragment: record.fragment }
  try {
    const discovered = await discoverArtifactEvidence(artifact, {
      relativePath: artifactPath,
      symbolOrProbeId: match[2],
      workspaceRoot,
    })
    if (discovered !== identifier) {
      return { category: 'unsupported-constraint-evidence', path: record.path, fragment: record.fragment }
    }
  }
  catch (error) {
    return {
      category: REFERENCE_MISMATCH_CATEGORIES.includes(error?.category)
        ? error.category
        : 'unreadable-verification-infrastructure',
      path: record.path,
      fragment: record.fragment,
    }
  }
}

export async function loadReferenceRecords(records, {
  artifactVersion,
  artifact,
  workspaceRoot,
} = {}) {
  if (!Array.isArray(records)) throw new TypeError('Reference records must be an array')
  const mismatches = []
  const evidenceChecks = []
  const paths = new Set()
  const fragments = new Set()
  const expectedArtifactVersion = artifact?.version ?? artifactVersion ?? '3.0.0'
  const requestedVersionMismatch = artifactVersion !== undefined
    && artifact !== undefined
    && artifactVersion !== artifact.version
  const loaded = records.map((record) => {
    if (!REFERENCE_RECORD_KINDS.has(record?.kind)) {
      throw new TypeError(`Unsupported Reference record kind: ${String(record?.kind)}`)
    }
    if (!isNonEmptyString(record.path)) mismatches.push({ category: 'missing-path', path: record.path, fragment: record.fragment })
    else if (paths.has(record.path)) mismatches.push({ category: 'duplicate-path', path: record.path, fragment: record.fragment })
    else paths.add(record.path)
    if (!isNonEmptyString(record.fragment) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.fragment)) {
      mismatches.push({ category: 'missing-fragment', path: record.path, fragment: record.fragment })
    }
    else if (fragments.has(record.fragment)) mismatches.push({ category: 'duplicate-fragment', path: record.path, fragment: record.fragment })
    else fragments.add(record.fragment)
    for (const field of ['title', 'description']) {
      if (!isNonEmptyString(record[field])) {
        mismatches.push({ category: 'missing-required-prose', path: record.path, fragment: record.fragment, field })
      }
    }
    const requiredHumanFields = {
      purpose: isNonEmptyString(record.purpose),
      ownership: isNonEmptyString(record.ownership),
      occurrences: areOccurrences(record.occurrences),
      scope: isNonEmptyString(record.scope),
      boundary: isNonEmptyString(record.boundary),
      deprecation: isDeprecation(record.deprecation),
      ...(record.kind === 'configuration-group'
        ? { precedence: isNonEmptyStringArray(record.precedence) }
        : {}),
      ...(record.kind === 'configuration-value'
        ? {
            precedence: isNonEmptyStringArray(record.precedence),
            default: isSummary(record.default, ['literal', 'conditional', 'inherited', 'omitted']),
            reset: isSummary(record.reset, ['value', 'omission', 'none']),
            minimumExample: isMinimumExample(record.minimumExample),
            lifecycle: isNonEmptyString(record.lifecycle),
            errorSemantics: isNonEmptyString(record.errorSemantics),
            supportedConstraint: isSupportedConstraint(record.supportedConstraint),
            recommendedRange: isSummary(record.recommendedRange, ['recommendation', 'none']),
            localValidation: isSummary(record.localValidation, ['validation', 'none']),
          }
        : {}),
      ...(record.kind === 'authoring-input'
        ? {
            transportTarget: isNonEmptyString(record.transportTarget),
            sourcePrecedence: isNonEmptyStringArray(record.sourcePrecedence),
            downstreamOwnership: isNonEmptyString(record.downstreamOwnership),
            minimumExample: isMinimumExample(record.minimumExample),
          }
        : {}),
      ...(record.kind === 'delegated-exception'
        ? {
            delegatedOwner: isNonEmptyString(record.delegatedOwner),
            transportRestrictions: isNonEmptyStringArray(record.transportRestrictions),
            packageFields: isPackageFields(record.packageFields),
            unknownKeyPolicy: isNonEmptyString(record.unknownKeyPolicy),
            allowances: isDelegatedAllowances(record.allowances),
            exclusions: isNonEmptyStringArray(record.exclusions),
            packageBehavior: isNonEmptyString(record.packageBehavior),
          }
        : {}),
    }
    for (const [field, valid] of Object.entries(requiredHumanFields)) {
      if (!valid) {
        mismatches.push({ category: 'missing-required-prose', path: record.path, fragment: record.fragment, field })
      }
    }
    if (isSupportedConstraint(record.supportedConstraint)) {
      for (const identifier of record.supportedConstraint.evidence) {
        evidenceChecks.push(evidenceMismatch(identifier, record, artifact, workspaceRoot))
      }
    }
    if (requestedVersionMismatch || record.artifactVersion !== expectedArtifactVersion) {
      mismatches.push({ category: 'artifact-version-mismatch', path: record.path, fragment: record.fragment })
    }
    if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
      mismatches.push({ category: 'unsupported-constraint-evidence', path: record.path, fragment: record.fragment })
    }
    else {
      for (const identifier of record.evidence) {
        evidenceChecks.push(evidenceMismatch(identifier, record, artifact, workspaceRoot))
      }
    }
    if (record.kind === 'configuration-group' && !Array.isArray(record.children)) {
      mismatches.push({ category: 'type-mismatch', path: record.path, fragment: record.fragment, field: 'children' })
    }
    if (record.kind === 'configuration-value' && !isNonEmptyString(record.valueType)) {
      mismatches.push({ category: 'type-mismatch', path: record.path, fragment: record.fragment, field: 'valueType' })
    }
    if (record.kind === 'authoring-input' && !isNonEmptyString(record.syntax)) {
      mismatches.push({ category: 'type-mismatch', path: record.path, fragment: record.fragment, field: 'syntax' })
    }
    if (record.kind === 'delegated-exception' && !isNonEmptyString(record.constraint)) {
      mismatches.push({ category: 'exception-mismatch', path: record.path, fragment: record.fragment, field: 'constraint' })
    }
    const loadedRecord = {
      kind: record.kind,
      path: record.path,
      fragment: record.fragment,
      title: record.title,
      description: record.description,
      artifactVersion: record.artifactVersion,
      evidence: Object.freeze(Array.isArray(record.evidence) ? [...record.evidence] : []),
    }
    projectHumanFields(record, loadedRecord)
    if (record.kind === 'configuration-group') loadedRecord.children = Object.freeze(Array.isArray(record.children) ? [...record.children] : [])
    if (record.kind === 'configuration-value') {
      loadedRecord.valueType = record.valueType
    }
    if (record.kind === 'authoring-input') loadedRecord.syntax = record.syntax
    if (record.kind === 'delegated-exception') loadedRecord.constraint = record.constraint
    return Object.freeze(loadedRecord)
  })
  mismatches.push(...(await Promise.all(evidenceChecks)).filter(Boolean))
  if (mismatches.length > 0) throw new ReferenceRecordValidationFailure(mismatches.sort(compareMismatch))
  const model = Object.freeze(loaded)
  LOADED_REFERENCE_MODELS.add(model)
  LOADED_REFERENCE_ARTIFACTS.set(model, artifact)
  return model
}

function compareInventory(expectedValues, observedValues, labels, mismatches) {
  const expected = new Set(expectedValues)
  const observed = new Set()
  for (const value of observedValues) {
    if (observed.has(value)) mismatches.push({ category: labels.duplicate, [labels.key]: value })
    observed.add(value)
  }
  for (const value of expected) {
    if (!observed.has(value)) mismatches.push({ category: labels.missing, [labels.key]: value })
  }
  for (const value of observed) {
    if (!expected.has(value)) mismatches.push({ category: labels.extra, [labels.key]: value })
  }
}

function literalString(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : undefined
}

function literalStringArray(node) {
  if (!node || !ts.isArrayLiteralExpression(node)) return undefined
  const values = node.elements.map(literalString)
  return values.every(value => value !== undefined) ? values : undefined
}

function literalStringSet(node) {
  if (!node
    || !ts.isNewExpression(node)
    || !ts.isIdentifier(node.expression)
    || node.expression.text !== 'Set'
    || node.arguments?.length !== 1) {
    return undefined
  }
  return literalStringArray(node.arguments[0])
}

function isRuntimeKeysWithoutEnabled(node) {
  if (!ts.isNewExpression(node)
    || !ts.isIdentifier(node.expression)
    || node.expression.text !== 'Set'
    || node.arguments?.length !== 1) {
    return false
  }
  const filter = node.arguments[0]
  if (!ts.isCallExpression(filter)
    || !ts.isPropertyAccessExpression(filter.expression)
    || filter.expression.name.text !== 'filter'
    || filter.arguments.length !== 1) {
    return false
  }
  const source = filter.expression.expression
  const callback = filter.arguments[0]
  if (!ts.isArrayLiteralExpression(source)
    || source.elements.length !== 1
    || !ts.isSpreadElement(source.elements[0])
    || !ts.isIdentifier(source.elements[0].expression)
    || source.elements[0].expression.text !== 'MODULE_OPTION_KEYS'
    || !ts.isArrowFunction(callback)
    || callback.parameters.length !== 1
    || !ts.isIdentifier(callback.parameters[0].name)
    || !ts.isBinaryExpression(callback.body)
    || callback.body.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken) {
    return false
  }
  const parameter = callback.parameters[0].name.text
  return (ts.isIdentifier(callback.body.left)
    && callback.body.left.text === parameter
    && literalString(callback.body.right) === 'enabled')
  || (literalString(callback.body.left) === 'enabled'
    && ts.isIdentifier(callback.body.right)
    && callback.body.right.text === parameter)
}

// The artifact validator owns every accepted package path in root and nested
// Set allowlists. Requiring its exact closed shape makes layout changes fail
// as unreadable infrastructure instead of silently producing a partial list.
function parseArtifactConfigurationInventory(source, file) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  let moduleOptionKeys
  let runtimeKeysDerived = false
  let validateRuntimeOptions
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue
        if (declaration.name.text === 'MODULE_OPTION_KEYS') {
          moduleOptionKeys = literalStringSet(declaration.initializer)
        }
        if (declaration.name.text === 'RUNTIME_OPTION_KEYS') {
          runtimeKeysDerived = isRuntimeKeysWithoutEnabled(declaration.initializer)
        }
      }
    }
    if (ts.isFunctionDeclaration(statement)
      && statement.name?.text === 'validateRuntimeOptions'
      && statement.body) {
      validateRuntimeOptions = statement
    }
  }
  if (!moduleOptionKeys?.includes('enabled') || !runtimeKeysDerived || !validateRuntimeOptions) {
    infrastructureFailure('unreadable-verification-infrastructure', 'artifact configuration allowlists could not be derived')
  }

  const paths = new Set(moduleOptionKeys)
  let runtimeRootValidated = false
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === 'assertKnownKeys') {
        if (ts.isIdentifier(node.arguments[1]) && node.arguments[1].text === 'RUNTIME_OPTION_KEYS') {
          runtimeRootValidated = true
        }
        else {
          const keys = literalStringSet(node.arguments[1])
          const parent = literalStringArray(node.arguments[3])
          if (!keys || !parent) {
            infrastructureFailure('unreadable-verification-infrastructure', 'artifact nested configuration allowlist is unreadable')
          }
          for (const key of keys) paths.add([...parent, key].join('.'))
        }
      }
      if (node.expression.text === 'assertObjectProperty') {
        const key = literalString(node.arguments[1])
        const parent = literalStringArray(node.arguments[3])
        if (key === undefined || !parent) {
          infrastructureFailure('unreadable-verification-infrastructure', 'artifact object configuration path is unreadable')
        }
        const objectPath = [...parent, key]
        paths.add(objectPath.join('.'))
        if (node.arguments[4]) {
          const keys = literalStringSet(node.arguments[4])
          if (!keys) {
            infrastructureFailure('unreadable-verification-infrastructure', 'artifact object configuration allowlist is unreadable')
          }
          for (const child of keys) paths.add([...objectPath, child].join('.'))
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(validateRuntimeOptions.body)
  if (!runtimeRootValidated
    || [...paths].some(path => !moduleOptionKeys.includes(path.split('.')[0]))) {
    infrastructureFailure('unreadable-verification-infrastructure', 'artifact configuration allowlists are internally inconsistent')
  }
  const contentMermaid = Object.freeze([...paths].sort())
  return Object.freeze({
    contentMermaid,
    runtimeConfigPublicContentMermaid: Object.freeze(contentMermaid.filter(path => path !== 'enabled')),
  })
}

async function probeArtifactRuntimeConfigurationInventory(artifact) {
  assertVerifiedArtifact(artifact)
  const relativePath = 'dist/runtime/configuration/module.js'
  await Promise.all([
    discoverArtifactEvidence(artifact, { relativePath, symbolOrProbeId: 'MODULE_OPTION_KEYS' }),
    discoverArtifactEvidence(artifact, { relativePath, symbolOrProbeId: 'validateRuntimeOptions' }),
  ])
  const artifactRoot = await verificationRealpath(artifact.artifactRoot, 'verified artifact root')
  const file = await verificationRealpath(resolve(artifactRoot, relativePath), 'artifact configuration validator')
  if (!isWithin(artifactRoot, file)) {
    infrastructureFailure('evidence-escape', 'artifact configuration validator escapes the verified artifact root')
  }
  let source
  try {
    source = await readFile(file, 'utf8')
  }
  catch (error) {
    infrastructureFailure('unreadable-verification-infrastructure', 'artifact configuration validator is unreadable', error)
  }
  return parseArtifactConfigurationInventory(source, file)
}

function collectClosedConfigurationPaths(checker, type, prefix, paths, visited, location) {
  const candidates = type.isUnion() ? type.types : [type]
  for (const candidate of candidates) {
    const current = checker.getNonNullableType(candidate)
    if (!(current.flags & ts.TypeFlags.Object)
      || checker.isArrayType(current)
      || checker.isTupleType(current)
      || checker.getIndexTypeOfType(current, ts.IndexKind.String)
      || checker.getSignaturesOfType(current, ts.SignatureKind.Call).length > 0) {
      continue
    }
    let prefixes = visited.get(current)
    if (!prefixes) {
      prefixes = new Set()
      visited.set(current, prefixes)
    }
    const prefixKey = prefix.join('.')
    if (prefixes.has(prefixKey)) continue
    prefixes.add(prefixKey)
    for (const property of checker.getPropertiesOfType(current)) {
      const path = [...prefix, property.name]
      paths.add(path.join('.'))
      const declaration = property.valueDeclaration ?? property.declarations?.[0] ?? location
      collectClosedConfigurationPaths(
        checker,
        checker.getTypeOfSymbolAtLocation(property, declaration),
        path,
        paths,
        visited,
        declaration,
      )
    }
  }
}

async function probeArtifactDeclarationConfigurationInventory(artifact) {
  assertVerifiedArtifact(artifact)
  const artifactRoot = await verificationRealpath(artifact.artifactRoot, 'verified artifact root')
  const declarations = await discoverPublicDeclarations(artifact)
  const declarationEntry = await verificationRealpath(
    resolve(artifactRoot, declarations.entry),
    'artifact public configuration declarations',
  )
  const virtualFile = resolve(artifactRoot, '.reference-probes', 'configuration-inventory.ts')
  const virtualSources = new Map([[
    virtualFile,
    [
      `import type { ModuleOptions, RuntimeOptions } from ${JSON.stringify(declarationEntry)}`,
      'type ReferenceModuleOptions = ModuleOptions',
      'type ReferenceRuntimeOptions = RuntimeOptions',
    ].join('\n'),
  ]])
  const program = createArtifactTypeScriptProgram(virtualSources)
  const diagnostics = ts.getPreEmitDiagnostics(program).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)
  const sourceFile = program.getSourceFile(virtualFile)
  if (diagnostics.length > 0 || !sourceFile) {
    infrastructureFailure('unreadable-verification-infrastructure', 'artifact public configuration declarations could not be inspected')
  }
  const checker = program.getTypeChecker()
  const aliases = new Map(sourceFile.statements
    .filter(ts.isTypeAliasDeclaration)
    .map(alias => [alias.name.text, alias]))
  function pathsFor(aliasName) {
    const alias = aliases.get(aliasName)
    if (!alias) {
      infrastructureFailure('unreadable-verification-infrastructure', `artifact configuration alias is missing: ${aliasName}`)
    }
    const paths = new Set()
    // String-indexed objects are delegated open payloads, so their descendants
    // intentionally stop at the package-owned boundary (for example loader.init).
    collectClosedConfigurationPaths(
      checker,
      checker.getTypeFromTypeNode(alias.type),
      [],
      paths,
      new WeakMap(),
      alias,
    )
    return Object.freeze([...paths].sort())
  }
  return Object.freeze({
    contentMermaid: pathsFor('ReferenceModuleOptions'),
    runtimeConfigPublicContentMermaid: pathsFor('ReferenceRuntimeOptions'),
  })
}

function observeArtifactConfigurationInventories(artifact) {
  let observation = ARTIFACT_CONFIGURATION_INVENTORIES.get(artifact)
  if (!observation) {
    observation = Promise.all([
      probeArtifactRuntimeConfigurationInventory(artifact),
      probeArtifactDeclarationConfigurationInventory(artifact),
    ])
    ARTIFACT_CONFIGURATION_INVENTORIES.set(artifact, observation)
    observation.catch(() => ARTIFACT_CONFIGURATION_INVENTORIES.delete(artifact))
  }
  return observation
}

const PARITY_CHECK_CATEGORIES = Object.freeze({
  types: 'type-mismatch',
  defaults: 'default-mismatch',
  conditionalDefaults: 'conditional-mismatch',
  delegatedDescendants: 'delegated-descendant',
  exceptions: 'exception-mismatch',
  deprecations: 'deprecation-mismatch',
  constraintEvidence: 'unsupported-constraint-evidence',
  snippets: 'snippet-failure',
})

export function checkReferenceParity(records, observation = {}) {
  if (!LOADED_REFERENCE_MODELS.has(records)) {
    throw new TypeError('Reference parity checker requires loader output')
  }
  return checkLoadedReferenceParity(records, observation)
}

async function checkLoadedReferenceParity(records, observation) {
  const mismatches = []
  const artifactVersion = records[0]?.artifactVersion
  if (observation.artifactVersion !== undefined && observation.artifactVersion !== artifactVersion) {
    mismatches.push({ category: 'artifact-version-mismatch' })
  }
  const verifiedArtifact = LOADED_REFERENCE_ARTIFACTS.get(records)
  let artifactInventoryUnreadable = false
  if (!verifiedArtifact) {
    artifactInventoryUnreadable = true
  }
  else {
    try {
      const artifactInventories = await observeArtifactConfigurationInventories(verifiedArtifact)
      for (const artifactInventory of artifactInventories) {
        compareInventory(CONFIGURATION_ACCEPTANCE.contentMermaid, artifactInventory.contentMermaid, {
          duplicate: 'duplicate-path',
          missing: 'missing-path',
          extra: 'extra-path',
          key: 'path',
        }, mismatches)
        compareInventory(
          CONFIGURATION_ACCEPTANCE.runtimeConfigPublicContentMermaid,
          artifactInventory.runtimeConfigPublicContentMermaid,
          {
            duplicate: 'duplicate-path',
            missing: 'missing-path',
            extra: 'extra-path',
            key: 'path',
          },
          mismatches,
        )
      }
    }
    catch (error) {
      mismatches.push({
        category: REFERENCE_MISMATCH_CATEGORIES.includes(error?.category)
          ? error.category
          : 'unreadable-verification-infrastructure',
      })
    }
  }
  compareInventory(records.map(record => record.path), observation.paths ?? [], {
    duplicate: 'duplicate-path',
    missing: 'missing-path',
    extra: 'extra-path',
    key: 'path',
  }, mismatches)
  compareInventory(records.map(record => record.fragment), observation.fragments ?? [], {
    duplicate: 'duplicate-fragment',
    missing: 'missing-fragment',
    extra: 'extra-fragment',
    key: 'fragment',
  }, mismatches)
  if ((observation.runtimePaths ?? []).includes('enabled')) {
    mismatches.push({ category: 'runtime-only-enabled', path: 'enabled' })
  }
  let checksUnreadable = false
  for (const [check, category] of Object.entries(PARITY_CHECK_CATEGORIES)) {
    const status = observation.checks?.[check]
    if (status === 'mismatch') mismatches.push({ category })
    else if (status !== 'match') checksUnreadable = true
  }
  if (checksUnreadable || artifactInventoryUnreadable) {
    mismatches.push({ category: 'unreadable-verification-infrastructure' })
  }
  const uniqueMismatches = new Map(mismatches.map(mismatch => [
    `${mismatch.category}\0${mismatch.path ?? ''}\0${mismatch.fragment ?? ''}\0${mismatch.field ?? ''}`,
    mismatch,
  ]))
  return Object.freeze([...uniqueMismatches.values()].sort(compareMismatch).map(Object.freeze))
}
