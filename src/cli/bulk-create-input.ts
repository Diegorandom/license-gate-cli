import type { LicenseGateLicenseCreateInput } from '../licensegate'

export function parseBulkCreateInputs(input: unknown): LicenseGateLicenseCreateInput[] {
  if (Array.isArray(input)) return input as LicenseGateLicenseCreateInput[]
  if (!input || typeof input !== 'object') throw new Error('bulk-create input must be a JSON array or an object with { count, data }')

  const template = input as { count?: unknown; data?: LicenseGateLicenseCreateInput & { expirationDate?: unknown } }
  const count = Number(template.count)
  if (!Number.isInteger(count) || count <= 0) throw new Error('bulk-create template requires a positive integer count')
  if (!template.data || typeof template.data !== 'object') throw new Error('bulk-create template requires a data object')

  const normalizedExpirationDate = normalizeExpirationDate(template.data.expirationDate)
  const normalizedData = { ...template.data, ...(normalizedExpirationDate !== undefined && { expirationDate: normalizedExpirationDate }) }
  return Array.from({ length: count }, () => ({ ...normalizedData }))
}

function normalizeExpirationDate(value: unknown) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'extendByDays' in value) {
    const days = Number((value as { extendByDays?: unknown }).extendByDays)
    if (!Number.isFinite(days)) throw new Error('expirationDate.extendByDays must be a number')
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  }
  throw new Error('Invalid expirationDate format')
}
