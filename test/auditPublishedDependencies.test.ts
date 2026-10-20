import { describe, expect, it } from 'vitest'
import {
  evaluateAuditReport,
  readPublishedDependencies,
} from '../scripts/release-verification/audit-published.mjs'

function auditReport(counts: Partial<Record<'low' | 'moderate' | 'high' | 'critical', number>>) {
  const vulnerabilities = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, ...counts }
  return {
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: {
      vulnerabilities: {
        ...vulnerabilities,
        total: Object.values(vulnerabilities).reduce((sum, count) => sum + count, 0),
      },
      dependencies: { prod: 134, dev: 0, optional: 1, peer: 0, peerOptional: 0, total: 134 },
    },
  }
}

describe('published dependency audit', () => {
  it('audits only the published manifest dependencies', () => {
    expect(readPublishedDependencies({
      name: '@barzhsieh/nuxt-content-mermaid',
      dependencies: { 'mermaid': '~11.17.0', 'html-to-image': '1.11.11' },
      devDependencies: { vitest: '^4.1.11' },
      peerDependencies: { nuxt: '^4.1.0' },
    })).toEqual({ 'mermaid': '~11.17.0', 'html-to-image': '1.11.11' })
  })

  it.each([
    [undefined],
    [{}],
    [{ dependencies: {} }],
  ])('fails on a missing or empty manifest %#', (manifest) => {
    expect(() => readPublishedDependencies(manifest)).toThrow('no dependencies to audit')
  })

  it.each([
    [{}],
    [{ low: 2 }],
    [{ low: 1, moderate: 3 }],
  ])('passes when nothing is high or critical %#', (counts) => {
    expect(evaluateAuditReport(auditReport(counts), 0).passed).toBe(true)
  })

  it.each([
    [{ high: 1 }],
    [{ critical: 1 }],
    [{ low: 2, high: 1, critical: 1 }],
  ])('fails on high or critical findings %#', (counts) => {
    expect(evaluateAuditReport(auditReport(counts), 1).passed).toBe(false)
  })

  it.each([
    ['an npm error report', {
      message: 'request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed, reason: ECONNREFUSED',
      error: { summary: '', detail: '' },
    }, 1, 'npm audit failed'],
    ['no report', null, 1, 'npm audit failed'],
    ['missing severity counts', { metadata: {} }, 0, 'missing severity counts'],
    ['an empty dependency scan', {
      ...auditReport({}),
      metadata: { ...auditReport({}).metadata, dependencies: { prod: 0 } },
    }, 0, 'scanned no production dependencies'],
    ['a nonzero exit without blocking findings', auditReport({ low: 2 }), 1, 'disagrees'],
    ['a zero exit with blocking findings', auditReport({ high: 1 }), 0, 'disagrees'],
  ])('fails closed on %s', (_name, report, exitCode, message) => {
    expect(() => evaluateAuditReport(report, exitCode)).toThrow(message)
  })
})
