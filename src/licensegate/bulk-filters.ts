import {
  type LicenseGateBulkUpdateFilter,
  type LicenseGateBulkUpdateInput,
  type LicenseGateExpirationDateUpdate,
  type LicenseGateLicense,
  type LicenseGateLicenseUpdateInput,
} from './types'

export function normalizeBulkUpdateInput(input: LicenseGateBulkUpdateInput): LicenseGateLicenseUpdateInput {
  const {
    ipLimit: _ipLimit,
    licenseScope: _licenseScope,
    validationPoints: _validationPoints,
    validationLimit: _validationLimit,
    replenishAmount: _replenishAmount,
    replenishInterval: _replenishInterval,
    ...rest
  } = input

  return {
    ...rest,
    expirationDate: resolveExpirationDate(input.expirationDate),
  }
}

export function resolveExpirationDate(expirationDate: LicenseGateExpirationDateUpdate | undefined) {
  if (expirationDate === undefined) return undefined
  if (expirationDate === null) return null
  if (expirationDate instanceof Date) return expirationDate.toISOString()
  if (typeof expirationDate === 'string') return expirationDate
  return new Date(Date.now() + expirationDate.extendByDays * 24 * 60 * 60 * 1000).toISOString()
}

export function matchesBulkUpdateFilter(license: LicenseGateLicense, filter?: LicenseGateBulkUpdateFilter) {
  if (!filter) return true

  const createdAt = new Date(license.createdAt)
  const expirationDate = license.expirationDate ? new Date(license.expirationDate) : undefined
  const now = Date.now()

  if (filter.createdWithinDays !== undefined) {
    const createdWithinMs = filter.createdWithinDays * 24 * 60 * 60 * 1000
    if (now - createdAt.getTime() > createdWithinMs) return false
  }

  const hasExpirationFilter =
    filter.expiringWithinDays !== undefined || filter.expiredWithinDays !== undefined
  if (hasExpirationFilter) {
    let expirationMatches = false

    if (filter.expiringWithinDays !== undefined && expirationDate) {
      const expiringWithinMs = filter.expiringWithinDays * 24 * 60 * 60 * 1000
      expirationMatches ||= expirationDate.getTime() >= now && expirationDate.getTime() <= now + expiringWithinMs
    }

    if (filter.expiredWithinDays !== undefined && expirationDate) {
      const expiredWithinMs = filter.expiredWithinDays * 24 * 60 * 60 * 1000
      expirationMatches ||= expirationDate.getTime() < now && expirationDate.getTime() >= now - expiredWithinMs
    }

    if (!expirationMatches) return false
  }

  return true
}
