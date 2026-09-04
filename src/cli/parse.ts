import type { CliOptions, Command } from './types'

export function parseArgs(args: string[]): CliOptions {
  const [command, ...rest] = args
  if (!isCommand(command)) throw new Error(helpText())

  const map = new Map<string, string>()
  const flags = new Set<string>()
  for (let i = 0; i < rest.length; i++) {
    const current = rest[i]
    if (!current.startsWith('--')) throw new Error(`Unexpected argument: ${current}`)
    if (current === '--dry-run') { flags.add(current); continue }
    const next = rest[i + 1]
    if (!next || next.startsWith('--')) throw new Error(`Missing value for ${current}`)
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
    apiKey,
    input,
    keyFilesDir: map.get('--key-files-dir') ?? './licenseKeyFiles',
    concurrency: Number(map.get('--concurrency') ?? '5'),
    dryRun: flags.has('--dry-run'),
    report: map.get('--report'),
  }
}

function isCommand(value: string): value is Command {
  return ['bulk-create', 'bulk-update', 'single-update', 'bulk-update-key-files'].includes(value)
}

export function helpText() {
  return [
    'Usage:',
    '  licensegate-bulk bulk-create --api-key <key> --input <file> [--concurrency <n>] [--dry-run] [--report <file>] [--base-url <url>]',
    '  licensegate-bulk bulk-update --api-key <key> --input <file> [--dry-run] [--report <file>] [--base-url <url>]  (interactive: y=yes, n=skip, q=quit, f=fast-forward all)',
    '  licensegate-bulk bulk-update-key-files --api-key <key> --input <file> [--key-files-dir <dir>] [--dry-run] [--report <file>] [--base-url <url>]',
    '  licensegate-bulk single-update --api-key <key> --input <file> [--dry-run] [--report <file>] [--base-url <url>]',
  ].join('\n')
}
