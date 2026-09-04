import type { LicenseGateLicenseCreateInput, LicenseGateLicenseUpdateInput } from '../types'

export function serializeLicenseInput(input: LicenseGateLicenseCreateInput | LicenseGateLicenseUpdateInput) {
  return {
    ...input,
    ...(input.expirationDate !== undefined && {
      expirationDate: input.expirationDate instanceof Date ? input.expirationDate.toISOString() : input.expirationDate,
    }),
  }
}

export function serializeLicenseUpdateInput(input: LicenseGateLicenseUpdateInput) {
  const serialized = serializeLicenseInput(input)
  return removeNullishDeep(serialized) as LicenseGateLicenseUpdateInput
}

function removeNullishDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => removeNullishDeep(item)).filter((item) => item !== null && item !== undefined)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, removeNullishDeep(item)] as const)
        .filter(([, item]) => item !== null && item !== undefined)
    )
  }

  return value
}
