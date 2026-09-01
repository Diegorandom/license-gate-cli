import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import {
  LicenseGateAdminClient,
  type BulkResult,
  type LicenseGateBulkUpdateItem,
  type LicenseGateLicense,
  type LicenseGateLicenseCreateInput,
} from './client'

type Command = 'bulk-create' | 'bulk-update'

interface CliOptions {
  command: Command
  baseUrl: string
  apiKey: string
  input: string
  concurrency: number
  dryRun: boolean
  report?: string
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const rawInput = await readFile(path.resolve(options.input), 'utf8')
  const parsedInput = JSON.parse(rawInput) as unknown

  if (!Array.isArray(parsedInput)) {
    throw new Error('Input file must contain a JSON array')
  }

  if (options.dryRun) {
    const summary = {
      command: options.command,
      baseUrl: options.baseUrl,
      input: options.input,
      items: parsedInput.length,
      concurrency: options.concurrency,
      dryRun: true,
    }

    console.log(JSON.stringify(summary, null, 2))
    return
  }

  const client = new LicenseGateAdminClient({
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
  })

  const result =
    options.command === 'bulk-create'
      ? await client.bulkCreate(parsedInput as LicenseGateLicenseCreateInput[], {
          concurrency: options.concurrency,
        })
      : await client.bulkUpdate(parsedInput as LicenseGateBulkUpdateItem[], {
          concurrency: options.concurrency,
        })

  await maybeWriteReport(options.report, result)

  console.log(
    JSON.stringify(
      {
        command: options.command,
        total: result.total,
        successCount: result.successCount,
        failureCount: result.failureCount,
        report: options.report ?? null,
      },
      null,
      2
    )
  )

  if (result.failureCount > 0) {
    process.exitCode = 1
  }
}

function parseArgs(args: string[]): CliOptions {
  const [command, ...rest] = args

  if (command !== 'bulk-create' && command !== 'bulk-update') {
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

  const baseUrl = map.get('--base-url') ?? process.env.LICENSEGATE_BASE_URL
  const apiKey = map.get('--api-key') ?? process.env.LICENSEGATE_API_KEY
  const input = map.get('--input')

  if (!baseUrl) throw new Error('Missing --base-url or LICENSEGATE_BASE_URL')
  if (!apiKey && !flags.has('--dry-run')) throw new Error('Missing --api-key or LICENSEGATE_API_KEY')
  if (!input) throw new Error('Missing --input')

  return {
    command,
    baseUrl,
    apiKey: apiKey ?? '',
    input,
    concurrency: Number(map.get('--concurrency') ?? '5'),
    dryRun: flags.has('--dry-run'),
    report: map.get('--report'),
  }
}

async function maybeWriteReport(
  reportPath: string | undefined,
  result: BulkResult<LicenseGateLicenseCreateInput | LicenseGateBulkUpdateItem, LicenseGateLicense>
) {
  if (!reportPath) return

  const resolvedPath = path.resolve(reportPath)
  await mkdir(path.dirname(resolvedPath), { recursive: true })
  await writeFile(resolvedPath, JSON.stringify(result, null, 2), 'utf8')
}

function helpText() {
  return [
    'Usage:',
    '  licensegate-bulk bulk-create --base-url <url> --api-key <key> --input <file> [--concurrency <n>] [--dry-run] [--report <file>]',
    '  licensegate-bulk bulk-update --base-url <url> --api-key <key> --input <file> [--concurrency <n>] [--dry-run] [--report <file>]',
  ].join('\n')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(message)
  process.exit(1)
})
