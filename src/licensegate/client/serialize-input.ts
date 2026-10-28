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
  // `expirationDate: null` es un valor, no un hueco: significa «esta licencia no
  // caduca» y la API lo acepta (licenseCreateSchema: z.date().nullish()). Si se
  // filtra aquí, la petición sale sin el campo y el PATCH se interpreta como
  // «no toques este campo» — que es exactamente lo contrario de lo pedido.
  const clearsExpiration = input.expirationDate === null
  const cleaned = removeNullishDeep(serialized) as LicenseGateLicenseUpdateInput
  if (clearsExpiration) (cleaned as { expirationDate?: null }).expirationDate = null
  return cleaned
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
