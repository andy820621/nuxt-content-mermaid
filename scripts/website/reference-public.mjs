import { loadWebsiteReferenceCorpus } from './reference-corpus.mjs'

const PACKAGE_IDENTITY = '@barzhsieh/nuxt-content-mermaid@3.0.0'
const ARTIFACT_VERSION = '3.0.0'
const SUMMARY_OBJECT_FIELDS = Object.freeze({
  'loader.init': Object.freeze({
    value: Object.freeze(['startOnLoad', 'theme', 'fontFamily', 'securityLevel']),
    outcomes: Object.freeze({
      'debug:false': Object.freeze(['logLevel', 'suppressErrorRendering']),
      'debug:true': Object.freeze(['logLevel', 'suppressErrorRendering']),
    }),
  }),
})

function projectStringList(values) {
  return Object.freeze(values.map(value => value))
}

function projectLiteralScalar(value) {
  if (value === null || ['boolean', 'string'].includes(typeof value)) return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  throw new TypeError('Reference public literal values must be JSON data')
}

function projectLiteralObject(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Reference public literal objects must match their public schema')
  }
  return Object.freeze(Object.fromEntries(
    fields.map(field => [field, projectLiteralScalar(value[field])]),
  ))
}

function projectOccurrence(occurrence) {
  return Object.freeze({
    surface: occurrence.surface,
    path: occurrence.path,
    scope: occurrence.scope,
    precedence: occurrence.precedence,
  })
}

function projectOccurrences(occurrences) {
  return Object.freeze(occurrences.map(projectOccurrence))
}

function projectDeprecation(deprecation) {
  return Object.freeze({
    status: deprecation.status,
    summary: deprecation.summary,
  })
}

function projectSummaryOutcomes(record, outcomes) {
  const outcomeFields = SUMMARY_OBJECT_FIELDS[record.path]?.outcomes
  if (!outcomeFields) return Object.freeze({})
  return Object.freeze(Object.fromEntries(
    Object.entries(outcomeFields).map(([condition, fields]) => [
      condition,
      projectLiteralObject(outcomes[condition], fields),
    ]),
  ))
}

function projectSummary(record, summary) {
  const valueFields = SUMMARY_OBJECT_FIELDS[record.path]?.value
  return Object.freeze({
    kind: summary.kind,
    summary: summary.summary,
    ...(Object.hasOwn(summary, 'value')
      ? { value: valueFields ? projectLiteralObject(summary.value, valueFields) : projectLiteralScalar(summary.value) }
      : {}),
    ...(summary.outcomes ? { outcomes: projectSummaryOutcomes(record, summary.outcomes) } : {}),
  })
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

function projectPackageFields(packageFields) {
  return Object.freeze({
    set: projectStringList(packageFields.set),
    read: projectStringList(packageFields.read),
  })
}

function projectAllowances(allowances) {
  return Object.freeze({
    functionPaths: projectStringList(allowances.functionPaths),
    regexpPaths: projectStringList(allowances.regexpPaths),
    opaqueIdentityPaths: projectStringList(allowances.opaqueIdentityPaths),
  })
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
    occurrences: projectOccurrences(record.occurrences),
    scope: record.scope,
    boundary: record.boundary,
    deprecation: projectDeprecation(record.deprecation),
    ...(record.explicitNegatives
      ? { explicitNegatives: projectStringList(record.explicitNegatives) }
      : {}),
  }
}

function projectConfigurationSemantics(record) {
  return {
    precedence: projectStringList(record.precedence),
    ...(record.default ? { default: projectSummary(record, record.default) } : {}),
    ...(record.reset ? { reset: projectSummary(record, record.reset) } : {}),
    ...(record.minimumExample ? { minimumExample: projectMinimumExample(record.minimumExample) } : {}),
    ...(record.lifecycle ? { lifecycle: record.lifecycle } : {}),
    ...(record.errorSemantics ? { errorSemantics: record.errorSemantics } : {}),
    ...(record.supportedConstraint
      ? { supportedConstraint: projectSupportedConstraint(record.supportedConstraint) }
      : {}),
    ...(record.recommendedRange ? { recommendedRange: projectSummary(record, record.recommendedRange) } : {}),
    ...(record.localValidation ? { localValidation: projectSummary(record, record.localValidation) } : {}),
  }
}

function projectGroupSemantics(record) {
  return {
    precedence: projectStringList(record.precedence),
    ...(record.default ? { default: projectSummary(record, record.default) } : {}),
    ...(record.reset ? { reset: projectSummary(record, record.reset) } : {}),
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
      children: projectStringList(record.children),
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
      sourcePrecedence: projectStringList(record.sourcePrecedence),
      downstreamOwnership: record.downstreamOwnership,
      minimumExample: projectMinimumExample(record.minimumExample),
    })
  }
  return Object.freeze({
    ...base,
    constraint: record.constraint,
    delegatedOwner: record.delegatedOwner,
    transportRestrictions: projectStringList(record.transportRestrictions),
    packageFields: projectPackageFields(record.packageFields),
    unknownKeyPolicy: record.unknownKeyPolicy,
    allowances: projectAllowances(record.allowances),
    exclusions: projectStringList(record.exclusions),
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
