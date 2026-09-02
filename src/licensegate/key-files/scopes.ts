import type { LicenseGateBulkUpdateItem } from '../types'

export function extractScopes(items: LicenseGateBulkUpdateItem[]) {
  return Array.from(
    new Set(
      items
        .map((item) => (item.scope ?? '').trim())
        .filter((scope): scope is string => scope.length > 0)
    )
  )
}
