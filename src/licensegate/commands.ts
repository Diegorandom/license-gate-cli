import type {
  LicenseGateBulkUpdateItem,
  LicenseGateLicense,
  LicenseGateLicenseCreateInput,
  LicenseGateSingleUpdateItem,
} from './types'

export type BulkCommandResult =
  | {
      command: 'bulk-create' | 'bulk-update'
      total: number
      successCount: number
      failureCount: number
      report: string | null
    }
  | {
      command: 'single-update'
      result: LicenseGateLicense
    }

export type ParsedInput =
  | LicenseGateLicenseCreateInput[]
  | LicenseGateBulkUpdateItem[]
  | LicenseGateSingleUpdateItem[]
