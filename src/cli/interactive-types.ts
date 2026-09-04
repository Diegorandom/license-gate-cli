export interface InteractiveBulkUpdateResult {
  command: 'bulk-update'
  total: number
  attempted: number
  successCount: number
  failureCount: number
  skippedCount: number
  terminatedEarly: boolean
  failures: Array<{ id: number; message: string }>
}
