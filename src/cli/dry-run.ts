import path from 'path'
import { LicenseGateAdminClient, resolveBulkTargets, runLicenseKeyFileBulkUpdate, type LicenseGateBulkUpdateItem } from '../licensegate'
import type { CliOptions } from './types'

export async function handleDryRun(options: CliOptions, parsedInput: unknown, createCount?: number) {
  if (options.command === 'bulk-update') {
    const client = new LicenseGateAdminClient({ baseUrl: options.baseUrl, apiKey: options.apiKey })
    const targets = await resolveBulkTargets(parsedInput as LicenseGateBulkUpdateItem[], () => client.listLicenses())
    return printJson({ command: options.command, baseUrl: options.baseUrl, input: options.input, items: (parsedInput as unknown[]).length, targetCount: targets.length, dryRun: true })
  }

  if (options.command === 'bulk-update-key-files') {
    const client = new LicenseGateAdminClient({ baseUrl: options.baseUrl, apiKey: options.apiKey })
    const result = await runLicenseKeyFileBulkUpdate(client, parsedInput as LicenseGateBulkUpdateItem[], path.resolve(options.keyFilesDir), true)
    return printJson({ command: result.command, input: options.input, keyFilesDir: options.keyFilesDir, plannedCount: result.plannedCount, planned: result.planned, dryRun: true })
  }

  const items = options.command === 'bulk-create' ? createCount ?? 0 : (parsedInput as unknown[]).length
  printJson({ command: options.command, baseUrl: options.baseUrl, input: options.input, items, concurrency: options.concurrency, dryRun: true })
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2))
}
