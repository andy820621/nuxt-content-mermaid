import process from 'node:process'
import { pathToFileURL } from 'node:url'

const API_BASE_URL = 'https://api.cloudflare.com/client/v4'
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const PAGE_SIZE = 20

function deploymentBranch(deployment) {
  const branch = deployment?.deployment_trigger?.metadata?.branch
  return typeof branch === 'string' && branch.length > 0 ? branch : null
}

function deploymentTimestamp(deployment) {
  const timestamp = Date.parse(deployment?.created_on)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function selectExpiredPreviewDeployments(deployments, { now, retentionDays }) {
  const cutoff = now.getTime() - retentionDays * MILLISECONDS_PER_DAY
  const newestByBranch = new Map()

  for (const deployment of deployments) {
    if (deployment?.environment !== 'preview') continue
    const branch = deploymentBranch(deployment)
    const timestamp = deploymentTimestamp(deployment)
    if (!branch || timestamp === null) continue
    newestByBranch.set(branch, Math.max(newestByBranch.get(branch) ?? -Infinity, timestamp))
  }

  return deployments.filter((deployment) => {
    if (deployment?.environment !== 'preview' || typeof deployment.id !== 'string') return false
    const branch = deploymentBranch(deployment)
    const timestamp = deploymentTimestamp(deployment)
    if (!branch || timestamp === null) return false
    return timestamp < cutoff && timestamp < newestByBranch.get(branch)
  })
}

function projectDeploymentsUrl(accountId, projectName) {
  return `${API_BASE_URL}/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}/deployments`
}

async function cloudflareRequest(fetch, url, apiToken, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...init.headers,
    },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || body?.success !== true) {
    const errors = Array.isArray(body?.errors)
      ? body.errors.map(error => error?.message).filter(Boolean).join('; ')
      : ''
    throw new Error(`Cloudflare API request failed (${response.status})${errors ? `: ${errors}` : ''}`)
  }
  return body
}

async function listDeployments({ accountId, apiToken, fetch, projectName }) {
  const deployments = []
  const baseUrl = projectDeploymentsUrl(accountId, projectName)

  for (let page = 1; page <= 1000; page += 1) {
    const url = new URL(baseUrl)
    url.searchParams.set('env', 'preview')
    url.searchParams.set('page', String(page))
    url.searchParams.set('per_page', String(PAGE_SIZE))
    const body = await cloudflareRequest(fetch, url, apiToken)
    if (!Array.isArray(body.result)) {
      throw new TypeError('Cloudflare deployment response did not contain a result array')
    }
    deployments.push(...body.result)

    const totalPages = Number(body.result_info?.total_pages)
    if (Number.isFinite(totalPages) ? page >= totalPages : body.result.length < PAGE_SIZE) {
      return deployments
    }
  }

  throw new Error('Cloudflare deployment pagination exceeded 1000 pages')
}

export async function cleanupPreviewDeployments({
  accountId,
  apiToken,
  dryRun = false,
  fetch = globalThis.fetch,
  now = new Date(),
  projectName,
  retentionDays,
}) {
  const deployments = await listDeployments({ accountId, apiToken, fetch, projectName })
  const selected = selectExpiredPreviewDeployments(deployments, { now, retentionDays })
  const deletedIds = []
  const baseUrl = projectDeploymentsUrl(accountId, projectName)

  if (!dryRun) {
    for (const deployment of selected) {
      await cloudflareRequest(
        fetch,
        `${baseUrl}/${encodeURIComponent(deployment.id)}?force=true`,
        apiToken,
        { method: 'DELETE' },
      )
      deletedIds.push(deployment.id)
    }
  }

  return {
    deletedIds,
    dryRun,
    selectedIds: selected.map(deployment => deployment.id),
    totalDeployments: deployments.length,
  }
}

function requiredEnvironmentVariable(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function parseRetentionDays(value) {
  const days = Number(value)
  if (!Number.isInteger(days) || days < 1) {
    throw new Error('PREVIEW_RETENTION_DAYS must be a positive integer')
  }
  return days
}

async function main() {
  const result = await cleanupPreviewDeployments({
    accountId: requiredEnvironmentVariable('CLOUDFLARE_ACCOUNT_ID'),
    apiToken: requiredEnvironmentVariable('CLOUDFLARE_PAGES_API_TOKEN'),
    dryRun: process.env.DRY_RUN === 'true',
    projectName: process.env.CLOUDFLARE_PAGES_PROJECT ?? 'nuxt-content-mermaid',
    retentionDays: parseRetentionDays(process.env.PREVIEW_RETENTION_DAYS ?? '30'),
  })

  console.log(JSON.stringify(result, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
