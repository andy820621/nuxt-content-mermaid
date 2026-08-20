export type CloudflarePagesDeployment = {
  id?: unknown
  environment?: unknown
  created_on?: unknown
  deployment_trigger?: {
    metadata?: {
      branch?: unknown
    }
  }
}

export type PreviewRetentionOptions = {
  now: Date
  retentionDays: number
}

export type CleanupPreviewDeploymentsOptions = PreviewRetentionOptions & {
  accountId: string
  apiToken: string
  dryRun?: boolean
  fetch?: typeof globalThis.fetch
  projectName: string
}

export type CleanupPreviewDeploymentsResult = {
  deletedIds: string[]
  dryRun: boolean
  selectedIds: string[]
  totalDeployments: number
}

export function selectExpiredPreviewDeployments(
  deployments: CloudflarePagesDeployment[],
  options: PreviewRetentionOptions,
): CloudflarePagesDeployment[]

export function cleanupPreviewDeployments(
  options: CleanupPreviewDeploymentsOptions,
): Promise<CleanupPreviewDeploymentsResult>
