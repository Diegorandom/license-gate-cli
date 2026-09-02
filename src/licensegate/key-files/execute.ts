import type { LicenseGateAdminClient } from '../client'
import type { LicenseGateBulkUpdateItem } from '../types'
import { loadLicenseKeyFiles } from './load'
import { planLicenseKeyFileUpdates } from './plan'
import { extractScopes } from './scopes'

export interface LicenseKeyFileBulkUpdateResult {
  command: 'bulk-update-key-files'
  plannedCount: number
  updatedCount: number
  failedCount: number
  planned: Array<{ id: number; licenseKey: string; expirationDate: string; reason: string; assignedAt?: string }>
  failures: Array<{ id: number; licenseKey: string; message: string }>
}

export async function runLicenseKeyFileBulkUpdate(
  client: LicenseGateAdminClient,
  inputItems: LicenseGateBulkUpdateItem[],
  keyFilesDir: string,
  dryRun: boolean
): Promise<LicenseKeyFileBulkUpdateResult> {
  const scopes = extractScopes(inputItems)
  if (scopes.length === 0) throw new Error('Input must include at least one scope for bulk-update-key-files')

  const [{ licenseKeys, orders }, licenses] = await Promise.all([
    loadLicenseKeyFiles(keyFilesDir),
    client.listLicenses(),
  ])

  const planned = planLicenseKeyFileUpdates({
    licenses,
    scopes,
    licenseKeys,
    orders,
    days: 8,
  })

  if (dryRun) {
    return {
      command: 'bulk-update-key-files',
      plannedCount: planned.length,
      updatedCount: 0,
      failedCount: 0,
      planned,
      failures: [],
    }
  }

  const failures: Array<{ id: number; licenseKey: string; message: string }> = []
  let updatedCount = 0

  for (const item of planned) {
    try {
      await client.updateLicense(item.id, { expirationDate: item.expirationDate })
      updatedCount++
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      failures.push({ id: item.id, licenseKey: item.licenseKey, message })
    }
  }

  return {
    command: 'bulk-update-key-files',
    plannedCount: planned.length,
    updatedCount,
    failedCount: failures.length,
    planned,
    failures,
  }
}
