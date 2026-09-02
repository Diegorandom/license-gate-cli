import {
  type LicenseGateBulkUpdateItem,
  type LicenseGateLicense,
  type LicenseGateLicenseUpdateInput,
  type LicenseGateSingleUpdateItem,
} from './types'
import { matchesBulkUpdateFilter, normalizeBulkUpdateInput } from './bulk-filters'

export async function resolveBulkTargets(
  inputs: Array<LicenseGateBulkUpdateItem | LicenseGateSingleUpdateItem>,
  listLicenses: () => Promise<LicenseGateLicense[]>
) {
  const targetedScopes = Array.from(
    new Set(inputs.map((input) => input.scope).filter((scope): scope is string => Boolean(scope)))
  )

  const licensesByScope = new Map<string, LicenseGateLicense[]>()
  if (targetedScopes.length > 0) {
    const licenses = await listLicenses()
    for (const scope of targetedScopes) {
      licensesByScope.set(
        scope,
        licenses.filter((license) => license.licenseScope === scope)
      )
    }
  }

  const expandedInputs: Array<{
    id: number
    scope?: string
    data: LicenseGateLicenseUpdateInput
  }> = []

  for (const input of inputs) {
    const normalizedData = normalizeBulkUpdateInput(input.data)

    if (input.id !== undefined) {
      expandedInputs.push({ id: input.id, scope: input.scope, data: normalizedData })
      continue
    }

    const scopedLicenses = filterScopedLicenses(
      licensesByScope.get(input.scope ?? '') ?? [],
      input.filter
    )

    for (const license of scopedLicenses) {
      expandedInputs.push({ id: license.id, scope: input.scope, data: normalizedData })
    }
  }

  return expandedInputs
}

function filterScopedLicenses(
  licenses: LicenseGateLicense[],
  filter: LicenseGateBulkUpdateItem['filter']
) {
  return licenses.filter((license) => matchesBulkUpdateFilter(license, filter))
}
