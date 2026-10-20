export type AuditSeverityCounts = Record<'info' | 'low' | 'moderate' | 'high' | 'critical' | 'total', number>

export function readPublishedDependencies(manifest: unknown): Record<string, string>
export function evaluateAuditReport(report: unknown, exitCode: number): {
  counts: AuditSeverityCounts
  passed: boolean
}
export function auditPublishedDependencies(options: {
  archivePath?: string
  repositoryRoot: string
}): Promise<{ counts: AuditSeverityCounts, passed: boolean }>
