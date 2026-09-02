import { readFile, readdir } from 'fs/promises'
import path from 'path'
import { csvRowsToObjects, parseCsv } from './csv'
import type { LicenseKeyFileRow, OrderFileRow } from './models'

const LICENSE_KEYS_FILE = 'License Keys.csv'
const ORDERS_FILE_PATTERN = /^Orders_.*\.csv$/i

export async function loadLicenseKeyFiles(baseDir: string) {
  const directoryEntries = await readdir(baseDir)
  const ordersFilename = directoryEntries.find((name) => ORDERS_FILE_PATTERN.test(name))

  if (!ordersFilename) {
    throw new Error(`Orders CSV not found in ${baseDir}`)
  }

  const [licenseKeysContent, ordersContent] = await Promise.all([
    readFile(path.join(baseDir, LICENSE_KEYS_FILE), 'utf8'),
    readFile(path.join(baseDir, ordersFilename), 'utf8'),
  ])

  return {
    licenseKeys: parseLicenseKeysCsv(licenseKeysContent),
    orders: parseOrdersCsv(ordersContent),
  }
}

function parseLicenseKeysCsv(content: string): LicenseKeyFileRow[] {
  return csvRowsToObjects(parseCsv(content)).map((row) => ({
    key: valueOf(row, ['key', 'license_key']),
    orderName: valueOf(row, ['order_name', 'order']),
    status: valueOf(row, ['status']),
  })).filter((row) => row.key.length > 0)
}

function parseOrdersCsv(content: string): OrderFileRow[] {
  return csvRowsToObjects(parseCsv(content)).flatMap((row) => {
    const orderName = valueOf(row, ['order_name', 'order'])
    const orderNumber = valueOf(row, ['order_number'])
    const assignedAt = parseDateFlexible(valueOf(row, ['date', 'assigned_at']))
    if (!orderName || !assignedAt) return []
    return [{ orderName, orderNumber, assignedAt }]
  })
}

function parseDateFlexible(value: string) {
  if (!value) return undefined

  const iso = new Date(value)
  if (!Number.isNaN(iso.getTime())) return iso

  const match = value.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!match) return undefined

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3])
  const hour = Number(match[4] ?? '0')
  const minute = Number(match[5] ?? '0')
  const second = Number(match[6] ?? '0')

  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function valueOf(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== '') return value
  }
  return ''
}
