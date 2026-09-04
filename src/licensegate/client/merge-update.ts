import type { LicenseGateLicense, LicenseGateLicenseUpdateInput } from '../types'

export function mergeWithCurrentLicense(input: LicenseGateLicenseUpdateInput, current: LicenseGateLicense) {
  const merged: LicenseGateLicenseUpdateInput = { ...input }
  if (merged.ipLimit === undefined && current.ipLimit !== null) merged.ipLimit = current.ipLimit
  if (merged.licenseScope === undefined && current.licenseScope !== null) merged.licenseScope = current.licenseScope
  if (merged.validationPoints === undefined && current.validationPoints !== null) merged.validationPoints = current.validationPoints
  if (merged.validationLimit === undefined && current.validationLimit !== null) merged.validationLimit = current.validationLimit
  if (merged.replenishAmount === undefined && current.replenishAmount !== null) merged.replenishAmount = current.replenishAmount
  if (merged.replenishInterval === undefined && current.replenishInterval !== null) merged.replenishInterval = current.replenishInterval
  return merged
}
