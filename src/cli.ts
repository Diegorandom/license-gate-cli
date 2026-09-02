import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { createInterface } from 'readline/promises'
import {
  LicenseGateAdminClient,
  LicenseGateAdminClientError,
  resolveBulkTargets,
  runLicenseKeyFileBulkUpdate,
  type BulkResult,
  type LicenseGateBulkUpdateItem,
  type LicenseGateLicense,
  type LicenseGateLicenseCreateInput,
  type LicenseGateLicenseUpdateInput,
  type LicenseGateSingleUpdateItem,
} from './licensegate'
import type { CliOptions, Command } from './cli/types'

interface InteractiveBulkUpdateResult {
  command: 'bulk-update'
  total: number
  attempted: number
  successCount: number
  failureCount: number
  skippedCount: number
  terminatedEarly: boolean
  failures: Array<{ id: number; message: string }>
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const rawInput = await readFile(path.resolve(options.input), 'utf8')
  const parsedInput = JSON.parse(rawInput) as unknown

  if (!Array.isArray(parsedInput)) {
    throw new Error('Input file must contain a JSON array')
  }

  if (options.dryRun) {
    if (options.command === 'bulk-update') {
      if (!options.apiKey) {
        throw new Error('Missing --api-key or LICENSEGATE_API_KEY for bulk-update --dry-run target counting')
      }

      const client = new LicenseGateAdminClient({
        baseUrl: options.baseUrl,
        apiKey: options.apiKey,
      })

      const targets = await resolveBulkTargets(parsedInput as LicenseGateBulkUpdateItem[], () => client.listLicenses())

      console.log(
        JSON.stringify(
          {
            command: options.command,
            baseUrl: options.baseUrl,
            input: options.input,
            items: parsedInput.length,
            targetCount: targets.length,
            dryRun: true,
          },
          null,
          2
        )
      )
      return
    }

    if (options.command === 'bulk-update-key-files') {
      const client = new LicenseGateAdminClient({
        baseUrl: options.baseUrl,
        apiKey: options.apiKey,
      })

      const result = await runLicenseKeyFileBulkUpdate(
        client,
        parsedInput as LicenseGateBulkUpdateItem[],
        path.resolve(options.keyFilesDir),
        true
      )

      console.log(
        JSON.stringify(
          {
            command: result.command,
            input: options.input,
            keyFilesDir: options.keyFilesDir,
            plannedCount: result.plannedCount,
            planned: result.planned,
            dryRun: true,
          },
          null,
          2
        )
      )
      return
    }

    console.log(
      JSON.stringify(
        {
          command: options.command,
          baseUrl: options.baseUrl,
          input: options.input,
          items: parsedInput.length,
          concurrency: options.concurrency,
          dryRun: true,
        },
        null,
        2
      )
    )
    return
  }

  const client = new LicenseGateAdminClient({
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
  })

  if (options.command === 'bulk-create') {
    const result = await client.bulkCreate(parsedInput as LicenseGateLicenseCreateInput[], {
      concurrency: options.concurrency,
    })
    await maybeWriteReport(options.report, result)
    printBulkResult(options.command, result, options.report)
    if (result.failureCount > 0) process.exitCode = 1
    return
  }

  if (options.command === 'bulk-update-key-files') {
    const result = await runLicenseKeyFileBulkUpdate(
      client,
      parsedInput as LicenseGateBulkUpdateItem[],
      path.resolve(options.keyFilesDir),
      options.dryRun
    )

    await maybeWriteReport(options.report, result)
    console.log(
      JSON.stringify(
        {
          command: result.command,
          plannedCount: result.plannedCount,
          updatedCount: result.updatedCount,
          failedCount: result.failedCount,
          report: options.report ?? null,
        },
        null,
        2
      )
    )
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
  if (!singleInput) {
    throw new Error('Input file must contain at least one item for single-update')
  }

  const result = await client.updateSingleLicense(singleInput)
  await maybeWriteReport(options.report, result)
  console.log(
    JSON.stringify(
      {
        command: options.command,
        result,
      },
      null,
      2
    )
  )
}

async function runInteractiveBulkUpdate(
  client: LicenseGateAdminClient,
  inputs: LicenseGateBulkUpdateItem[]
): Promise<InteractiveBulkUpdateResult> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('bulk-update interactive mode requires a TTY terminal')
  }

  const licenses = await client.listLicenses()
  const licenseKeyById = new Map<number, string>(licenses.map((license) => [license.id, license.licenseKey]))
  const targets = await resolveBulkTargets(inputs, async () => licenses)
  const failures: Array<{ id: number; message: string }> = []

  let attempted = 0
  let successCount = 0
  let failureCount = 0
  let skippedCount = 0
  let terminatedEarly = false
  let fastForward = false

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  try {
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]

      console.log(
        JSON.stringify(
          {
            index: i + 1,
            total: targets.length,
            id: target.id,
            licenseKey: licenseKeyById.get(target.id) ?? null,
            scope: target.scope ?? null,
            data: target.data,
          },
          null,
          2
        )
      )

      let updateData = target.data

      if (!fastForward) {
        const action = await askBulkUpdateAction(rl)
        if (action === 'quit') {
          terminatedEarly = true
          break
        }

        if (action === 'skip') {
          skippedCount++
          continue
        }

        if (action === 'fast-forward') {
          fastForward = true
          console.log('Fast-forward enabled: remaining licenses will be updated automatically.')
        }

        updateData = await maybeCustomizeExpirationDate(rl, target.data)
      }

      attempted++

      try {
        await client.updateLicense(target.id, updateData)
        successCount++
      } catch (error) {
        failureCount++
        const message = formatUpdateError(error)
        failures.push({ id: target.id, message })
        console.error(`Failed to update license ${target.id}: ${message}`)
      }
    }
  } finally {
    rl.close()
  }

  return {
    command: 'bulk-update',
    total: targets.length,
    attempted,
    successCount,
    failureCount,
    skippedCount,
    terminatedEarly,
    failures,
  }
}

async function askBulkUpdateAction(rl: ReturnType<typeof createInterface>) {
  while (true) {
    const value = (await rl.question('Update this license? [y]es / [n]o / [q]uit / [f]ast-forward: ')).trim().toLowerCase()

    if (value === 'y' || value === 'yes') return 'update' as const
    if (value === 'n' || value === 'no') return 'skip' as const
    if (value === 'q' || value === 'quit') return 'quit' as const
    if (value === 'f' || value === 'fast-forward') return 'fast-forward' as const

    console.log('Please answer with y, n, q, or f.')
  }
}

async function maybeCustomizeExpirationDate(
  rl: ReturnType<typeof createInterface>,
  data: LicenseGateLicenseUpdateInput
) {
  while (true) {
    const answer = (await rl.question('Set a custom expiration extension for this license? [y]es / [n]o: '))
      .trim()
      .toLowerCase()

    if (answer === 'n' || answer === 'no') {
      return data
    }

    if (answer === 'y' || answer === 'yes') {
      const days = await askDaysToExtend(rl)
      return {
        ...data,
        expirationDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
      }
    }

    console.log('Please answer with y or n.')
  }
}

async function askDaysToExtend(rl: ReturnType<typeof createInterface>) {
  while (true) {
    const value = (await rl.question('How many days to extend from now? ')).trim()
    const days = Number(value)

    if (Number.isInteger(days) && days > 0) {
      return days
    }

    console.log('Please enter a positive integer number of days.')
  }
}

function parseArgs(args: string[]): CliOptions {
  const [command, ...rest] = args

  if (!isCommand(command)) {
    throw new Error(helpText())
  }

  const map = new Map<string, string>()
  const flags = new Set<string>()

  for (let i = 0; i < rest.length; i++) {
    const current = rest[i]
    if (!current.startsWith('--')) {
      throw new Error(`Unexpected argument: ${current}`)
    }

    if (current === '--dry-run') {
      flags.add(current)
      continue
    }

    const next = rest[i + 1]
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for ${current}`)
    }

    map.set(current, next)
    i++
  }

  const baseUrl = map.get('--base-url') ?? process.env.LICENSEGATE_BASE_URL ?? 'https://api.licensegate.io'
  const apiKey = map.get('--api-key') ?? process.env.LICENSEGATE_API_KEY
  const input = map.get('--input')

  if (!apiKey) throw new Error('Missing --api-key or LICENSEGATE_API_KEY')
  if (!input) throw new Error('Missing --input')

  return {
    command,
    baseUrl,
    apiKey: apiKey ?? '',
    input,
    keyFilesDir: map.get('--key-files-dir') ?? './licenseKeyFiles',
    concurrency: Number(map.get('--concurrency') ?? '5'),
    dryRun: flags.has('--dry-run'),
    report: map.get('--report'),
  }
}

function isCommand(value: string): value is Command {
  return value === 'bulk-create' || value === 'bulk-update' || value === 'single-update' || value === 'bulk-update-key-files'
}

async function maybeWriteReport(reportPath: string | undefined, result: unknown) {
  if (!reportPath) return

  const resolvedPath = path.resolve(reportPath)
  await mkdir(path.dirname(resolvedPath), { recursive: true })
  await writeFile(resolvedPath, JSON.stringify(result, null, 2), 'utf8')
}

function printBulkResult(
  command: 'bulk-create' | 'bulk-update',
  result: BulkResult<LicenseGateLicenseCreateInput, LicenseGateLicense> | BulkResult<LicenseGateBulkUpdateItem, LicenseGateLicense>,
  reportPath: string | undefined
) {
  console.log(
    JSON.stringify(
      {
        command,
        total: result.total,
        successCount: result.successCount,
        failureCount: result.failureCount,
        report: reportPath ?? null,
      },
      null,
      2
    )
  )
}

function printInteractiveBulkUpdateResult(
  result: InteractiveBulkUpdateResult,
  reportPath: string | undefined
) {
  console.log(
    JSON.stringify(
      {
        command: result.command,
        total: result.total,
        attempted: result.attempted,
        successCount: result.successCount,
        failureCount: result.failureCount,
        skippedCount: result.skippedCount,
        terminatedEarly: result.terminatedEarly,
        report: reportPath ?? null,
      },
      null,
      2
    )
  )
}

function helpText() {
  return [
    'Usage:',
    '  licensegate-bulk bulk-create --api-key <key> --input <file> [--concurrency <n>] [--dry-run] [--report <file>] [--base-url <url>]',
    '  licensegate-bulk bulk-update --api-key <key> --input <file> [--dry-run] [--report <file>] [--base-url <url>]  (interactive: y=yes, n=skip, q=quit, f=fast-forward all)',
    '  licensegate-bulk bulk-update-key-files --api-key <key> --input <file> [--key-files-dir <dir>] [--dry-run] [--report <file>] [--base-url <url>]',
    '  licensegate-bulk single-update --api-key <key> --input <file> [--dry-run] [--report <file>] [--base-url <url>]',
  ].join('\n')
}

function formatUpdateError(error: unknown) {
  if (error instanceof LicenseGateAdminClientError) {
    const details =
      error.details == null
        ? ''
        : ` | details: ${typeof error.details === 'string' ? error.details : JSON.stringify(error.details)}`

    return `${error.message} (status: ${error.status})${details}`
  }

  if (error instanceof Error) return error.message
  return 'Unknown error'
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(message)
  process.exit(1)
})
