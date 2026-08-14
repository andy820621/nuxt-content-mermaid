import { loadWebsiteReferenceCorpus } from './reference-corpus.mjs'

const PACKAGE_IDENTITY = '@barzhsieh/nuxt-content-mermaid@3.0.0'
const ARTIFACT_VERSION = '3.0.0'

function clonePublicValue(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(clonePublicValue))
  if (value && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clonePublicValue(item)]),
    ))
  }
  return value
}

function projectMinimumExample(example) {
  return Object.freeze({
    language: example.language,
    source: example.source,
  })
}

function projectSupportedConstraint(constraint) {
  return Object.freeze({ summary: constraint.summary })
}

function projectBase(record) {
  return {
    kind: record.kind,
    path: record.path,
    fragment: record.fragment,
    title: record.title,
    description: record.description,
    purpose: record.purpose,
    ownership: record.ownership,
    occurrences: clonePublicValue(record.occurrences),
    scope: record.scope,
    boundary: record.boundary,
    deprecation: clonePublicValue(record.deprecation),
    ...(record.explicitNegatives
      ? { explicitNegatives: clonePublicValue(record.explicitNegatives) }
      : {}),
  }
}

function projectConfigurationSemantics(record) {
  return {
    precedence: clonePublicValue(record.precedence),
    ...(record.default ? { default: clonePublicValue(record.default) } : {}),
    ...(record.reset ? { reset: clonePublicValue(record.reset) } : {}),
    ...(record.minimumExample ? { minimumExample: projectMinimumExample(record.minimumExample) } : {}),
    ...(record.lifecycle ? { lifecycle: record.lifecycle } : {}),
    ...(record.errorSemantics ? { errorSemantics: record.errorSemantics } : {}),
    ...(record.supportedConstraint
      ? { supportedConstraint: projectSupportedConstraint(record.supportedConstraint) }
      : {}),
    ...(record.recommendedRange ? { recommendedRange: clonePublicValue(record.recommendedRange) } : {}),
    ...(record.localValidation ? { localValidation: clonePublicValue(record.localValidation) } : {}),
  }
}

function projectGroupSemantics(record) {
  return {
    precedence: clonePublicValue(record.precedence),
    ...(record.default ? { default: clonePublicValue(record.default) } : {}),
    ...(record.reset ? { reset: clonePublicValue(record.reset) } : {}),
    ...(record.minimumExample ? { minimumExample: projectMinimumExample(record.minimumExample) } : {}),
    ...(record.lifecycle ? { lifecycle: record.lifecycle } : {}),
  }
}

function projectRecord(record) {
  const base = projectBase(record)
  if (record.kind === 'configuration-group') {
    return Object.freeze({
      ...base,
      ...projectGroupSemantics(record),
      children: clonePublicValue(record.children),
    })
  }
  if (record.kind === 'configuration-value') {
    return Object.freeze({
      ...base,
      ...projectConfigurationSemantics(record),
      valueType: record.valueType,
    })
  }
  if (record.kind === 'authoring-input') {
    return Object.freeze({
      ...base,
      syntax: record.syntax,
      transportTarget: record.transportTarget,
      sourcePrecedence: clonePublicValue(record.sourcePrecedence),
      downstreamOwnership: record.downstreamOwnership,
      minimumExample: projectMinimumExample(record.minimumExample),
    })
  }
  return Object.freeze({
    ...base,
    constraint: record.constraint,
    delegatedOwner: record.delegatedOwner,
    transportRestrictions: clonePublicValue(record.transportRestrictions),
    packageFields: clonePublicValue(record.packageFields),
    unknownKeyPolicy: record.unknownKeyPolicy,
    allowances: clonePublicValue(record.allowances),
    exclusions: clonePublicValue(record.exclusions),
    packageBehavior: record.packageBehavior,
  })
}

export function projectWebsiteReferencePublicModel(records) {
  const projected = records.map(projectRecord)
  const active = record => record.deprecation.status !== 'deprecated-accepted-no-op'
  const sections = Object.freeze({
    configurationGroups: Object.freeze(projected.filter(record => record.kind === 'configuration-group' && active(record))),
    configurationValues: Object.freeze(projected.filter(record => record.kind === 'configuration-value' && active(record))),
    authoringInputs: Object.freeze(projected.filter(record => record.kind === 'authoring-input')),
    delegatedPayloads: Object.freeze(projected.filter(record => record.kind === 'delegated-exception')),
    deprecatedOptions: Object.freeze(projected.filter(record => record.deprecation.status === 'deprecated-accepted-no-op')),
  })
  return Object.freeze({
    identity: PACKAGE_IDENTITY,
    recordCount: projected.length,
    sections,
  })
}

export async function loadWebsiteReferencePublicModel({
  artifact,
  repositoryRoot,
} = {}) {
  const records = await loadWebsiteReferenceCorpus({
    artifact,
    artifactVersion: ARTIFACT_VERSION,
    repositoryRoot,
  })
  return projectWebsiteReferencePublicModel(records)
}
