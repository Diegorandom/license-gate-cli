import { readFile } from 'fs/promises'
import path from 'path'
import { LicenseGateAdminClient, runLicenseKeyFileBulkUpdate, type LicenseGateBulkUpdateItem, type LicenseGateSingleUpdateItem } from '../licensegate'
import type { CliOptions } from './types'
import { parseArgs } from './parse'
import { parseBulkCreateInputs } from './bulk-create-input'
import { handleDryRun } from './dry-run'
import { runInteractiveBulkUpdate } from './interactive-bulk-update'
import { buildBulkCreateReport, maybeWriteReport, printInteractiveBulkUpdateResult, printKeyFileBulkUpdateResult, printSingleUpdateResult, printStandardBulkResult, writeBulkCreateKeyList } from './output'

export async function runCli() {
  const options = parseArgs(process.argv.slice(2))
  const parsedInput = await readInput(options.input)
  const createInputs = options.command === 'bulk-create' ? parseBulkCreateInputs(parsedInput) : undefined

  if (options.command !== 'bulk-create' && !Array.isArray(parsedInput)) {
    throw new Error('Input file must contain a JSON array')
  }

  if (options.dryRun) {
    await handleDryRun(options, parsedInput, createInputs?.length)
    return
  }

  const client = new LicenseGateAdminClient({ baseUrl: options.baseUrl, apiKey: options.apiKey })

  if (options.command === 'bulk-create') {
    const result = await client.bulkCreate(createInputs!, { concurrency: options.concurrency })
    const report = buildBulkCreateReport(result)
    await maybeWriteReport(options.report, report)
    await writeBulkCreateKeyList(options.report, report.createdLicenseKeys)
    printStandardBulkResult(options.command, result, options.report)
    if (result.failureCount > 0) process.exitCode = 1
    return
  }

  if (options.command === 'bulk-update-key-files') {
    const result = await runLicenseKeyFileBulkUpdate(client, parsedInput as LicenseGateBulkUpdateItem[], path.resolve(options.keyFilesDir), false)
    await maybeWriteReport(options.report, result)
    printKeyFileBulkUpdateResult(result, options.report)
    if (result.failedCount > 0) process.exitCode = 1
    return
  }

  if (options.command === 'bulk-update') {
    const result = await runInteractiveBulkUpdate(client, parsedInput as LicenseGateBulkUpdateItem[])
    await maybeWriteReport(options.report, result)
    printInteractiveBulkUpdateResult(result, options.report)
    if (result.failureCount > 0) process.exitCode = 1
    return
  }

  const [singleInput] = parsedInput as LicenseGateSingleUpdateItem[]
  if (!singleInput) throw new Error('Input file must contain at least one item for single-update')
  const result = await client.updateSingleLicense(singleInput)
  await maybeWriteReport(options.report, result)
  printSingleUpdateResult(options.command, result)
}

async function readInput(inputPath: string) {
  const raw = await readFile(path.resolve(inputPath), 'utf8')
  return JSON.parse(raw) as unknown
}
