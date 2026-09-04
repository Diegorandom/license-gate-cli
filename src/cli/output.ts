import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import type { BulkResult, LicenseGateBulkUpdateItem, LicenseGateLicense, LicenseGateLicenseCreateInput } from '../licensegate'
import type { InteractiveBulkUpdateResult } from './interactive-types'
import type { LicenseKeyFileBulkUpdateResult } from '../licensegate/key-files/execute'

export async function maybeWriteReport(reportPath: string | undefined, result: unknown) {
  if (!reportPath) return
  const resolvedPath = path.resolve(reportPath)
  await mkdir(path.dirname(resolvedPath), { recursive: true })
  await writeFile(resolvedPath, JSON.stringify(result, null, 2), 'utf8')
}

export function buildBulkCreateReport(result: BulkResult<LicenseGateLicenseCreateInput, LicenseGateLicense>) {
  const createdLicenseKeys = result.results.filter((item) => item.success).map((item) => item.data.licenseKey)
  return { ...result, createdLicenseKeys }
}

export async function writeBulkCreateKeyList(reportPath: string | undefined, keys: string[]) {
  if (!reportPath) return
  const resolvedPath = path.resolve(reportPath)
  const parsed = path.parse(resolvedPath)
  const keyListPath = path.join(parsed.dir, `${parsed.name}-keys.txt`)
  await writeFile(keyListPath, keys.join('\n'), 'utf8')
}

export function printStandardBulkResult(
  command: 'bulk-create' | 'bulk-update',
  result: BulkResult<LicenseGateLicenseCreateInput, LicenseGateLicense> | BulkResult<LicenseGateBulkUpdateItem, LicenseGateLicense>,
  reportPath: string | undefined
) { printJson({ command, total: result.total, successCount: result.successCount, failureCount: result.failureCount, report: reportPath ?? null }) }

export function printInteractiveBulkUpdateResult(result: InteractiveBulkUpdateResult, reportPath: string | undefined) {
  printJson({ ...result, report: reportPath ?? null })
}

export function printKeyFileBulkUpdateResult(result: LicenseKeyFileBulkUpdateResult, reportPath: string | undefined) {
  printJson({ command: result.command, plannedCount: result.plannedCount, updatedCount: result.updatedCount, failedCount: result.failedCount, report: reportPath ?? null })
}

export function printSingleUpdateResult(command: 'single-update', result: LicenseGateLicense) {
  printJson({ command, result })
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2))
}
