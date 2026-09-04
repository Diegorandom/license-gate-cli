import { createInterface } from 'readline/promises'
import { LicenseGateAdminClient, LicenseGateAdminClientError, resolveBulkTargets, type LicenseGateBulkUpdateItem, type LicenseGateLicenseUpdateInput } from '../licensegate'
import type { InteractiveBulkUpdateResult } from './interactive-types'

export async function runInteractiveBulkUpdate(client: LicenseGateAdminClient, inputs: LicenseGateBulkUpdateItem[]): Promise<InteractiveBulkUpdateResult> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('bulk-update interactive mode requires a TTY terminal')

  const licenses = await client.listLicenses()
  const licenseKeyById = new Map<number, string>(licenses.map((license) => [license.id, license.licenseKey]))
  const targets = await resolveBulkTargets(inputs, async () => licenses)
  const failures: Array<{ id: number; message: string }> = []

  let attempted = 0, successCount = 0, failureCount = 0, skippedCount = 0
  let terminatedEarly = false, fastForward = false
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  try {
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]
      console.log(JSON.stringify({ index: i + 1, total: targets.length, id: target.id, licenseKey: licenseKeyById.get(target.id) ?? null, scope: target.scope ?? null, data: target.data }, null, 2))
      let updateData = target.data

      if (!fastForward) {
        const action = await askBulkUpdateAction(rl)
        if (action === 'quit') { terminatedEarly = true; break }
        if (action === 'skip') { skippedCount++; continue }
        if (action === 'fast-forward') { fastForward = true; console.log('Fast-forward enabled: remaining licenses will be updated automatically.') }
        updateData = await maybeCustomizeExpirationDate(rl, target.data)
      }

      attempted++
      try { await client.updateLicense(target.id, updateData); successCount++ }
      catch (error) { failureCount++; const message = formatUpdateError(error); failures.push({ id: target.id, message }); console.error(`Failed to update license ${target.id}: ${message}`) }
    }
  } finally { rl.close() }

  return { command: 'bulk-update', total: targets.length, attempted, successCount, failureCount, skippedCount, terminatedEarly, failures }
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

async function maybeCustomizeExpirationDate(rl: ReturnType<typeof createInterface>, data: LicenseGateLicenseUpdateInput) {
  while (true) {
    const answer = (await rl.question('Set a custom expiration extension for this license? [y]es / [n]o: ')).trim().toLowerCase()
    if (answer === 'n' || answer === 'no') return data
    if (answer === 'y' || answer === 'yes') {
      const days = await askDaysToExtend(rl)
      return { ...data, expirationDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() }
    }
    console.log('Please answer with y or n.')
  }
}

async function askDaysToExtend(rl: ReturnType<typeof createInterface>) {
  while (true) {
    const days = Number((await rl.question('How many days to extend from now? ')).trim())
    if (Number.isInteger(days) && days > 0) return days
    console.log('Please enter a positive integer number of days.')
  }
}

function formatUpdateError(error: unknown) {
  if (error instanceof LicenseGateAdminClientError) {
    const details = error.details == null ? '' : ` | details: ${typeof error.details === 'string' ? error.details : JSON.stringify(error.details)}`
    return `${error.message} (status: ${error.status})${details}`
  }
  return error instanceof Error ? error.message : 'Unknown error'
}
