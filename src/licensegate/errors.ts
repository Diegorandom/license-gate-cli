export class LicenseGateAdminClientError extends Error {
  status: number
  code?: string
  details?: unknown

  constructor(message: string, options: { status: number; code?: string; details?: unknown }) {
    super(message)
    this.name = 'LicenseGateAdminClientError'
    this.status = options.status
    this.code = options.code
    this.details = options.details
  }
}
