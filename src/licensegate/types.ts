export type ReplenishInterval = 'TEN_SECONDS' | 'MINUTE' | 'HOUR' | 'DAY'

export interface LicenseGateLicense {
  id: number
  active: boolean
  userId: number
  licenseKey: string
  name: string
  notes: string
  ipLimit: number | null
  licenseScope: string | null
  expirationDate: string | null
  validationPoints: number | null
  validationLimit: number | null
  replenishAmount: number | null
  replenishInterval: ReplenishInterval | null
  createdAt: string
}

export interface LicenseGateLicenseCreateInput {
  name: string
  notes: string
  active: boolean
  ipLimit?: number | null
  licenseScope?: string | null
  expirationDate?: string | Date | null
  validationPoints?: number | null
  validationLimit?: number | null
  replenishAmount?: number | null
  replenishInterval?: ReplenishInterval | null
  licenseKey?: string
}

export interface LicenseGateLicenseUpdateInput {
  active?: boolean
  licenseKey?: string
  name?: string
  notes?: string
  ipLimit?: number | null
  licenseScope?: string | null
  expirationDate?: string | Date | null
  validationPoints?: number | null
  validationLimit?: number | null
  replenishAmount?: number | null
  replenishInterval?: ReplenishInterval | null
}

export type LicenseGateExpirationDateUpdate = string | Date | null | { extendByDays: number }

export interface LicenseGateBulkUpdateInput extends Omit<LicenseGateLicenseUpdateInput, 'expirationDate'> {
  expirationDate?: LicenseGateExpirationDateUpdate
}

export interface LicenseGateBulkUpdateFilter {
  createdWithinDays?: number
  expiringWithinDays?: number
  expiredWithinDays?: number
  activatedAtLeastOnce?: boolean
}

export interface LicenseGateBulkUpdateItem {
  id?: number
  scope?: string
  filter?: LicenseGateBulkUpdateFilter
  data: LicenseGateBulkUpdateInput
}

export interface LicenseGateSingleUpdateItem {
  id?: number
  scope?: string
  filter?: LicenseGateBulkUpdateFilter
  data: LicenseGateBulkUpdateInput
}

export interface LicenseGateLogEntry {
  id: number
  userId: number
  licenseId: number
  ip: string
  result: string
  metadata: string
  timestamp: string
  license: {
    name: string
    licenseKey: string
  }
}

export interface LicenseGateLogsListInput {
  filter: {
    licenseId?: number
    result?: string[]
  }
  size: number
  after?: number
  before?: number
}

export interface LicenseGateBulkOptions {
  concurrency?: number
}

export type BulkItemResult<TInput, TOutput> =
  | { index: number; input: TInput; success: true; data: TOutput }
  | { index: number; input: TInput; success: false; error: Error }

export interface BulkResult<TInput, TOutput> {
  total: number
  successCount: number
  failureCount: number
  results: Array<BulkItemResult<TInput, TOutput>>
}
