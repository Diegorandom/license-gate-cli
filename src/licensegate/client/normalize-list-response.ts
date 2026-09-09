import { LicenseGateAdminClientError } from '../errors'
import type { LicenseGateLicense } from '../types'

export function normalizeLicenseListResponse(payload: unknown): { licenses: LicenseGateLicense[]; count?: number } {
  if (Array.isArray(payload)) return { licenses: payload as LicenseGateLicense[] }

  const response = payload as {
    licenses?: unknown
    items?: unknown
    data?: unknown
    result?: unknown
    count?: unknown
    total?: unknown
  }

  if (Array.isArray(response?.licenses)) return { licenses: response.licenses as LicenseGateLicense[], count: countValue(response) }
  if (Array.isArray(response?.items)) return { licenses: response.items as LicenseGateLicense[], count: countValue(response) }
  if (Array.isArray(response?.data)) return { licenses: response.data as LicenseGateLicense[], count: countValue(response) }
  if (Array.isArray(response?.result)) return { licenses: response.result as LicenseGateLicense[], count: countValue(response) }

  throw new LicenseGateAdminClientError('Unexpected /admin/licenses response shape', { status: 0, details: payload })
}

function countValue(response: { count?: unknown; total?: unknown }) {
  return typeof response.count === 'number' ? response.count : typeof response.total === 'number' ? response.total : undefined
}
