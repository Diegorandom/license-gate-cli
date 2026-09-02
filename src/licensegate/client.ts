import { resolveBulkTargets } from './bulk-targets'
import { runBulk } from './bulk-executor'
import { requestJson } from './http'
import { LicenseGateAdminClientError } from './errors'
import {
  type BulkResult,
  type LicenseGateBulkOptions,
  type LicenseGateBulkUpdateItem,
  type LicenseGateLicense,
  type LicenseGateLicenseCreateInput,
  type LicenseGateLicenseUpdateInput,
  type LicenseGateSingleUpdateItem,
} from './types'

export class LicenseGateAdminClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetchImplementation: typeof fetch

  constructor({
    baseUrl,
    apiKey,
    fetch: fetchImplementation,
  }: {
    baseUrl: string
    apiKey: string
    fetch?: typeof fetch
  }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.apiKey = apiKey
    this.fetchImplementation = fetchImplementation ?? fetch
  }

  async createLicense(input: LicenseGateLicenseCreateInput) {
    return requestJson<LicenseGateLicense>(this.fetchImplementation, this.baseUrl, this.apiKey, '/admin/licenses', {
      method: 'POST',
      body: JSON.stringify(this.serializeLicenseInput(input)),
    })
  }

  async updateLicense(id: number, input: LicenseGateLicenseUpdateInput, currentLicense?: LicenseGateLicense) {
    const current = currentLicense ?? (await this.getLicenseById(id))
    const payload = this.serializeLicenseUpdateInput(this.mergeWithCurrentLicense(input, current))

    try {
      return await requestJson<LicenseGateLicense>(
        this.fetchImplementation,
        this.baseUrl,
        this.apiKey,
        `/admin/licenses/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload, (_key, value) => (value === null ? undefined : value)),
        }
      )
    } catch (error) {
      if (error instanceof LicenseGateAdminClientError) {
        throw new LicenseGateAdminClientError(error.message, {
          status: error.status,
          code: error.code,
          details: {
            requestPayload: payload,
            responseDetails: error.details,
          },
        })
      }

      throw error
    }
  }

  async listLicenses() {
    const take = 100
    let skip = 0
    let totalCount: number | undefined
    const all: LicenseGateLicense[] = []

    while (true) {
      const payload = await requestJson<unknown>(
        this.fetchImplementation,
        this.baseUrl,
        this.apiKey,
        `/admin/licenses?take=${take}&skip=${skip}`
      )

      const { licenses, count } = this.normalizeLicenseListResponse(payload)
      all.push(...licenses)

      if (totalCount === undefined && typeof count === 'number') {
        totalCount = count
      }

      if (licenses.length < take) break
      skip += licenses.length

      if (totalCount !== undefined && skip >= totalCount) break
    }

    return all
  }

  async bulkCreate(
    inputs: LicenseGateLicenseCreateInput[],
    options: LicenseGateBulkOptions = {}
  ): Promise<BulkResult<LicenseGateLicenseCreateInput, LicenseGateLicense>> {
    return runBulk(inputs, (input) => this.createLicense(input), options, this.toClientError)
  }

  async bulkUpdate(
    inputs: LicenseGateBulkUpdateItem[],
    options: LicenseGateBulkOptions = {}
  ): Promise<BulkResult<LicenseGateBulkUpdateItem, LicenseGateLicense>> {
    const licenses = await this.listLicenses()
    const licenseById = new Map<number, LicenseGateLicense>(licenses.map((license) => [license.id, license]))
    const targetItems = await resolveBulkTargets(inputs, async () => licenses)

    return runBulk(
      targetItems,
      (input) => this.updateLicense(input.id, input.data, licenseById.get(input.id)),
      options,
      this.toClientError
    )
  }

  async updateSingleLicense(input: LicenseGateSingleUpdateItem): Promise<LicenseGateLicense> {
    const licenses = await this.listLicenses()
    const targets = await resolveBulkTargets([input], async () => licenses)

    if (targets.length !== 1) {
      throw new LicenseGateAdminClientError(
        targets.length === 0
          ? 'No matching license found for single update'
          : 'Single update requires exactly one matching license',
        { status: 0 }
      )
    }

    const current = licenses.find((license) => license.id === targets[0].id)
    return this.updateLicense(targets[0].id, targets[0].data, current)
  }

  private async getLicenseById(id: number) {
    const licenses = await this.listLicenses()
    const license = licenses.find((item) => item.id === id)

    if (!license) {
      throw new LicenseGateAdminClientError(`License ${id} not found`, { status: 0 })
    }

    return license
  }

  private mergeWithCurrentLicense(input: LicenseGateLicenseUpdateInput, current: LicenseGateLicense): LicenseGateLicenseUpdateInput {
    const merged: LicenseGateLicenseUpdateInput = { ...input }

    if (merged.ipLimit === undefined && current.ipLimit !== null) merged.ipLimit = current.ipLimit
    if (merged.licenseScope === undefined && current.licenseScope !== null) merged.licenseScope = current.licenseScope
    if (merged.validationPoints === undefined && current.validationPoints !== null) merged.validationPoints = current.validationPoints
    if (merged.validationLimit === undefined && current.validationLimit !== null) merged.validationLimit = current.validationLimit
    if (merged.replenishAmount === undefined && current.replenishAmount !== null) merged.replenishAmount = current.replenishAmount
    if (merged.replenishInterval === undefined && current.replenishInterval !== null) merged.replenishInterval = current.replenishInterval

    return merged
  }

  private toClientError(error: unknown) {
    if (error instanceof LicenseGateAdminClientError) {
      return error
    }

    if (error instanceof Error) {
      return new LicenseGateAdminClientError(error.message, { status: 0 })
    }

    return new LicenseGateAdminClientError('Unknown error', { status: 0, details: error })
  }

  private serializeLicenseInput(
    input: LicenseGateLicenseCreateInput | LicenseGateLicenseUpdateInput
  ) {
    return {
      ...input,
      ...(input.expirationDate !== undefined && {
        expirationDate:
          input.expirationDate instanceof Date
            ? input.expirationDate.toISOString()
            : input.expirationDate,
      }),
    }
  }

  private serializeLicenseUpdateInput(input: LicenseGateLicenseUpdateInput) {
    const serialized = this.serializeLicenseInput(input)
    return this.removeNullishDeep(serialized) as LicenseGateLicenseUpdateInput
  }

  private removeNullishDeep(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.removeNullishDeep(item))
        .filter((item) => item !== null && item !== undefined)
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .map(([key, item]) => [key, this.removeNullishDeep(item)] as const)
          .filter(([, item]) => item !== null && item !== undefined)
      )
    }

    return value
  }

  private normalizeLicenseListResponse(payload: unknown): { licenses: LicenseGateLicense[]; count?: number } {
    if (Array.isArray(payload)) {
      return { licenses: payload as LicenseGateLicense[] }
    }

    const response = payload as {
      licenses?: unknown
      items?: unknown
      data?: unknown
      result?: unknown
      count?: unknown
      total?: unknown
    }

    if (Array.isArray(response?.licenses)) {
      return {
        licenses: response.licenses as LicenseGateLicense[],
        count: typeof response.count === 'number' ? response.count : typeof response.total === 'number' ? response.total : undefined,
      }
    }

    if (Array.isArray(response?.items)) {
      return {
        licenses: response.items as LicenseGateLicense[],
        count: typeof response.count === 'number' ? response.count : typeof response.total === 'number' ? response.total : undefined,
      }
    }

    if (Array.isArray(response?.data)) {
      return {
        licenses: response.data as LicenseGateLicense[],
        count: typeof response.count === 'number' ? response.count : typeof response.total === 'number' ? response.total : undefined,
      }
    }

    if (Array.isArray(response?.result)) {
      return {
        licenses: response.result as LicenseGateLicense[],
        count: typeof response.count === 'number' ? response.count : typeof response.total === 'number' ? response.total : undefined,
      }
    }

    throw new LicenseGateAdminClientError('Unexpected /admin/licenses response shape', {
      status: 0,
      details: payload,
    })
  }
}
