import type { LicenseGateLicense } from '../types'
import type { LicenseKeyFilePlannedUpdate, LicenseKeyFileRow, OrderFileRow } from './models'

export function planLicenseKeyFileUpdates({
  licenses,
  scopes,
  licenseKeys,
  orders,
  days,
  now = new Date(),
}: {
  licenses: LicenseGateLicense[]
  scopes: string[]
  licenseKeys: LicenseKeyFileRow[]
  orders: OrderFileRow[]
  days: number
  now?: Date
}): LicenseKeyFilePlannedUpdate[] {
  const scopeSet = new Set(scopes.map((scope) => normalizeScope(scope)).filter((scope) => scope.length > 0))
  const licensesByKey = new Map(
    licenses
      .filter((license) => {
        const scope = normalizeScope(license.licenseScope)
        return scope.length > 0 && scopeSet.has(scope)
      })
      .map((license) => [normalizeKey(license.licenseKey), license])
  )

  const orderDateByRef = new Map<string, Date>()
  for (const order of orders) {
    for (const ref of orderRefs(order)) orderDateByRef.set(ref, order.assignedAt)
  }

  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000
  const updates = new Map<number, LicenseKeyFilePlannedUpdate>()

  for (const row of licenseKeys) {
    const license = licensesByKey.get(normalizeKey(row.key))
    if (!license) continue

    const orderRef = normalizeOrderRef(row.orderName)
    const orderDate = orderRef ? orderDateByRef.get(orderRef) : undefined

    if (orderRef && orderDate && orderDate.getTime() >= cutoff) {
      updates.set(license.id, {
        id: license.id,
        licenseKey: license.licenseKey,
        expirationDate: addDays(orderDate, days).toISOString(),
        reason: 'ASSIGNED_WITHIN_WINDOW',
        assignedAt: orderDate.toISOString(),
      })
      continue
    }

    if (!orderRef && isAvailableStatus(row.status)) {
      updates.set(license.id, {
        id: license.id,
        licenseKey: license.licenseKey,
        expirationDate: addDays(now, days).toISOString(),
        reason: 'AVAILABLE',
      })
    }
  }

  return Array.from(updates.values())
}

function orderRefs(order: OrderFileRow) {
  const refs = [normalizeOrderRef(order.orderName), normalizeOrderRef(order.orderNumber)].filter((value): value is string => Boolean(value))
  return Array.from(new Set(refs))
}

function normalizeOrderRef(value?: string) {
  if (!value) return ''
  const normalized = value.trim().toLowerCase().replace(/^order\s*/i, '').replace(/\s+/g, '')
  if (!normalized) return ''
  const numberOnly = normalized.replace(/^#/, '')
  return numberOnly.length > 0 ? `#${numberOnly}` : normalized
}

function normalizeScope(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function normalizeKey(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function isAvailableStatus(status?: string) {
  const value = (status ?? '').toLowerCase()
  return value.includes('available') || value.includes('unassigned')
}
function addDays(base: Date, days: number) { return new Date(base.getTime() + days * 24 * 60 * 60 * 1000) }
