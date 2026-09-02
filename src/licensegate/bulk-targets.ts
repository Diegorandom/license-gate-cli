import {
  type LicenseGateBulkUpdateFilter,
  type LicenseGateBulkUpdateItem,
  type LicenseGateLicense,
  type LicenseGateLicenseUpdateInput,
  type LicenseGateLogsListInput,
  type LicenseGateSingleUpdateItem,
} from './types'
import { matchesBulkUpdateFilter, normalizeBulkUpdateInput } from './bulk-filters'

export async function resolveBulkTargets(
  inputs: Array<LicenseGateBulkUpdateItem | LicenseGateSingleUpdateItem>,
  listLicenses: () => Promise<LicenseGateLicense[]>,
  listLogs: (input: LicenseGateLogsListInput) => Promise<Array<{ licenseId: number }>>
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

    const scopedLicenses = await filterScopedLicenses(
      licensesByScope.get(input.scope ?? '') ?? [],
      input.filter,
      listLogs
    )

    for (const license of scopedLicenses) {
      expandedInputs.push({ id: license.id, scope: input.scope, data: normalizedData })
    }
  }

  return expandedInputs
}

async function filterScopedLicenses(
  licenses: LicenseGateLicense[],
  filter: LicenseGateBulkUpdateFilter | undefined,
  listLogs: (input: LicenseGateLogsListInput) => Promise<Array<{ licenseId: number }>>
) {
  const candidateLicenses = licenses.filter((license) => matchesBulkUpdateFilter(license, filter))

  if (filter?.activatedAtLeastOnce === undefined) {
    return candidateLicenses
  }

  const checks = await Promise.all(
    candidateLicenses.map(async (license) => ({
      license,
      activated: await licenseHasSuccessfulValidation(license.id, listLogs),
    }))
  )

  return checks
    .filter((check) =>
      filter.activatedAtLeastOnce ? check.activated : !check.activated
    )
    .map((check) => check.license)
}

async function licenseHasSuccessfulValidation(
  licenseId: number,
  listLogs: (input: LicenseGateLogsListInput) => Promise<Array<{ licenseId: number }>>
) {
  const logs = await listLogs({
    filter: {
      licenseId,
      result: ['VALID'],
    },
    size: 1,
  })

  return logs.length > 0
}
