import { resolveBulkTargets } from './bulk-targets'
import { runBulk } from './bulk-executor'
import { requestJson, requestTrpc } from './http'
import { LicenseGateAdminClientError } from './errors'
import {
  type BulkResult,
  type LicenseGateBulkOptions,
  type LicenseGateBulkUpdateItem,
  type LicenseGateLicense,
  type LicenseGateLicenseCreateInput,
  type LicenseGateLicenseUpdateInput,
  type LicenseGateLogEntry,
  type LicenseGateLogsListInput,
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

  async updateLicense(id: number, input: LicenseGateLicenseUpdateInput) {
    return requestJson<LicenseGateLicense>(
      this.fetchImplementation,
      this.baseUrl,
      this.apiKey,
      `/admin/licenses/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(this.serializeLicenseInput(input)),
      }
    )
  }

  async listLicenses() {
    const payload = await requestJson<unknown>(this.fetchImplementation, this.baseUrl, this.apiKey, '/admin/licenses')
    return this.normalizeLicenseListResponse(payload)
  }

  async listLogs(input: LicenseGateLogsListInput) {
    return requestTrpc<LicenseGateLogEntry[]>(this.fetchImplementation, this.baseUrl, this.apiKey, 'logs.list', input)
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
    const targetItems = await resolveBulkTargets(inputs, () => this.listLicenses(), (input) => this.listLogs(input))
    return runBulk(targetItems, (input) => this.updateLicense(input.id, input.data), options, this.toClientError)
  }

  async updateSingleLicense(input: LicenseGateSingleUpdateItem): Promise<LicenseGateLicense> {
    const targets = await resolveBulkTargets([input], () => this.listLicenses(), (input) => this.listLogs(input))
    if (targets.length !== 1) {
      throw new LicenseGateAdminClientError(
        targets.length === 0
          ? 'No matching license found for single update'
          : 'Single update requires exactly one matching license',
        { status: 0 }
      )
    }

    return this.updateLicense(targets[0].id, targets[0].data)
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

  private normalizeLicenseListResponse(payload: unknown): LicenseGateLicense[] {
    if (Array.isArray(payload)) {
      return payload as LicenseGateLicense[]
    }

    const response = payload as {
      licenses?: unknown
      items?: unknown
      data?: unknown
      result?: unknown
    }

    if (Array.isArray(response?.licenses)) return response.licenses as LicenseGateLicense[]
    if (Array.isArray(response?.items)) return response.items as LicenseGateLicense[]
    if (Array.isArray(response?.data)) return response.data as LicenseGateLicense[]
    if (Array.isArray(response?.result)) return response.result as LicenseGateLicense[]

    throw new LicenseGateAdminClientError('Unexpected /admin/licenses response shape', {
      status: 0,
      details: payload,
    })
  }
}
