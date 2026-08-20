import { describe, expect, it } from 'vitest'
import {
  cleanupPreviewDeployments,
  selectExpiredPreviewDeployments,
} from '../scripts/cloudflare-pages/preview-cleanup.mjs'

const NOW = new Date('2026-08-20T00:00:00.000Z')

function deployment({
  branch = 'feature/example',
  createdOn,
  environment = 'preview',
  id,
}: {
  branch?: string | null
  createdOn: string
  environment?: string
  id: string
}) {
  return {
    id,
    environment,
    created_on: createdOn,
    deployment_trigger: {
      metadata: branch === null ? {} : { branch },
    },
  }
}

describe('Cloudflare Pages preview retention policy', () => {
  it('deletes only expired non-latest previews from each branch', () => {
    const deployments = [
      deployment({ id: 'feature-old', createdOn: '2026-06-01T00:00:00.000Z' }),
      deployment({ id: 'feature-latest', createdOn: '2026-08-10T00:00:00.000Z' }),
      deployment({ id: 'merged-old', branch: 'feature/merged', createdOn: '2026-05-01T00:00:00.000Z' }),
      deployment({ id: 'merged-latest', branch: 'feature/merged', createdOn: '2026-06-15T00:00:00.000Z' }),
      deployment({ id: 'production-old', environment: 'production', createdOn: '2026-01-01T00:00:00.000Z' }),
      deployment({ id: 'unknown-branch', branch: null, createdOn: '2026-01-01T00:00:00.000Z' }),
      deployment({ id: 'invalid-date', branch: 'feature/invalid', createdOn: 'not-a-date' }),
    ]

    expect(selectExpiredPreviewDeployments(deployments, {
      now: NOW,
      retentionDays: 30,
    }).map(item => item.id)).toEqual([
      'feature-old',
      'merged-old',
    ])
  })

  it('preserves every deployment tied for newest on a branch', () => {
    const deployments = [
      deployment({ id: 'older', createdOn: '2026-01-01T00:00:00.000Z' }),
      deployment({ id: 'latest-a', createdOn: '2026-02-01T00:00:00.000Z' }),
      deployment({ id: 'latest-b', createdOn: '2026-02-01T00:00:00.000Z' }),
    ]

    expect(selectExpiredPreviewDeployments(deployments, {
      now: NOW,
      retentionDays: 30,
    }).map(item => item.id)).toEqual(['older'])
  })
})

describe('Cloudflare Pages preview cleanup client', () => {
  it('paginates deployment listing and deletes selected deployments with force', async () => {
    const requests: Array<{ method: string, url: string }> = []
    const fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      requests.push({ method, url })

      if (method === 'DELETE') {
        return Response.json({ success: true, result: null })
      }

      const page = new URL(url).searchParams.get('page')
      return Response.json({
        success: true,
        result: page === '1'
          ? [deployment({ id: 'old', createdOn: '2026-01-01T00:00:00.000Z' })]
          : [deployment({ id: 'latest', createdOn: '2026-08-01T00:00:00.000Z' })],
        result_info: {
          page: Number(page),
          total_pages: 2,
        },
      })
    }

    const result = await cleanupPreviewDeployments({
      accountId: 'account-id',
      apiToken: 'api-token',
      fetch,
      now: NOW,
      projectName: 'nuxt-content-mermaid',
      retentionDays: 30,
    })

    expect(result).toEqual({
      deletedIds: ['old'],
      dryRun: false,
      selectedIds: ['old'],
      totalDeployments: 2,
    })
    expect(requests).toHaveLength(3)
    expect(requests[0]).toMatchObject({ method: 'GET' })
    expect(requests[1]).toMatchObject({ method: 'GET' })
    expect(Object.fromEntries(new URL(requests[0]!.url).searchParams)).toEqual({
      env: 'preview',
      page: '1',
      per_page: '20',
    })
    expect(requests[2]).toEqual({
      method: 'DELETE',
      url: 'https://api.cloudflare.com/client/v4/accounts/account-id/pages/projects/nuxt-content-mermaid/deployments/old?force=true',
    })
  })

  it('supports dry runs without deleting anything', async () => {
    const requests: string[] = []
    const fetch = async (input: string | URL | Request) => {
      requests.push(String(input))
      return Response.json({
        success: true,
        result: [
          deployment({ id: 'old', createdOn: '2026-01-01T00:00:00.000Z' }),
          deployment({ id: 'latest', createdOn: '2026-02-01T00:00:00.000Z' }),
        ],
        result_info: { page: 1, total_pages: 1 },
      })
    }

    const result = await cleanupPreviewDeployments({
      accountId: 'account-id',
      apiToken: 'api-token',
      dryRun: true,
      fetch,
      now: NOW,
      projectName: 'nuxt-content-mermaid',
      retentionDays: 30,
    })

    expect(result).toMatchObject({
      deletedIds: [],
      dryRun: true,
      selectedIds: ['old'],
    })
    expect(requests).toHaveLength(1)
  })
})
