import { readFile } from 'fs/promises'
import path from 'path'
import { LicenseGateAdminClient, resolveBulkTargets, runLicenseKeyFileBulkUpdate, type LicenseGateBulkUpdateItem, type LicenseGateSingleUpdateItem } from '../licensegate'
import type { CliOptions } from './types'
import { parseArgs } from './parse'
import { parseBulkCreateInputs } from './bulk-create-input'
import { handleDryRun } from './dry-run'
import { runInteractiveBulkUpdate } from './interactive-bulk-update'
import { buildBulkCreateReport, maybeWriteReport, printInteractiveBulkUpdateResult, printKeyFileBulkUpdateResult, printSingleUpdateResult, printStandardBulkResult, writeBulkCreateKeyList } from './output'

export async function runCli() {
  const options = parseArgs(process.argv.slice(2))
  // `reactivate` se dirige por clave, no por fichero de entrada.
  const parsedInput = options.command === 'reactivate' ? [] : await readInput(options.input)
  const createInputs = options.command === 'bulk-create' ? parseBulkCreateInputs(parsedInput) : undefined

  if (options.command !== 'bulk-create' && !Array.isArray(parsedInput)) {
    throw new Error('Input file must contain a JSON array')
  }

  if (options.dryRun && options.command !== 'reactivate') {
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

  if (options.command === 'reactivate') {
    const days = options.days ?? 30
    const current = await client.getLicenseByKey(options.key!)
    // Se suma sobre la fecha que el cliente YA tiene si es futura: renovar pronto
    // no puede quitarle los días que le quedan. Si está caducada, se cuenta desde ahora.
    const now = Date.now()
    const currentExpiry = current.expirationDate ? new Date(current.expirationDate).getTime() : 0
    const base = new Date(Math.max(now, currentExpiry))
    const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
    const summary = {
      command: 'reactivate',
      id: current.id,
      scope: current.licenseScope,
      key: current.licenseKey,
      from: current.expirationDate,
      baseForExtension: base.toISOString(),
      to: next,
      days,
      applied: !options.dryRun,
    }
    if (options.dryRun) {
      console.log(JSON.stringify(summary, null, 2))
      console.log('\n(dry-run: no se ha escrito nada. Añade --yes para aplicarlo.)')
      return
    }
    const updated = await client.updateLicense(current.id, { expirationDate: next }, current)
    await maybeWriteReport(options.report, { ...summary, result: { id: updated.id, expirationDate: updated.expirationDate } })
    console.log(JSON.stringify({ ...summary, to: updated.expirationDate, report: options.report ?? null }, null, 2))
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
    if (options.yes) {
      // Camino no interactivo. Se resuelven los objetivos ANTES de mutar para
      // poder abortar por tope: `bulk-update` pide TTY porque la confirmación es
      // licencia a licencia, y eso hace imposible cualquier lote scriptado.
      const items = parsedInput as LicenseGateBulkUpdateItem[]
      const targets = await resolveBulkTargets(items, () => client.listLicenses())
      if (targets.length === 0) {
        console.log(JSON.stringify({ command: 'bulk-update', targetCount: 0, mutated: false }, null, 2))
        return
      }
      const max = options.maxTargets ?? 50
      if (targets.length > max) {
        throw new Error(`Abortado: ${targets.length} objetivos supera --max ${max}. Sube el tope a proposito si es lo que quieres.`)
      }
      const result = await client.bulkUpdate(items, { concurrency: options.concurrency })
      await maybeWriteReport(options.report, result)
      printStandardBulkResult('bulk-update', result, options.report)
      if (result.failureCount > 0) process.exitCode = 1
      return
    }
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
