export interface LicenseKeyFileRow {
  key: string
  orderName?: string
  status?: string
}

export interface OrderFileRow {
  orderName: string
  orderNumber?: string
  assignedAt: Date
}

export type LicenseKeyFileUpdateReason = 'AVAILABLE' | 'ASSIGNED_WITHIN_WINDOW'

export interface LicenseKeyFilePlannedUpdate {
  id: number
  licenseKey: string
  expirationDate: string
  reason: LicenseKeyFileUpdateReason
  assignedAt?: string
}
