import { resolveBulkTargets } from './bulk-targets'
import { runBulk } from './bulk-executor'
import { requestJson } from './http'
import { LicenseGateAdminClientError } from './errors'
import { listAllLicenses } from './client/list-licenses'
import { mergeWithCurrentLicense } from './client/merge-update'
import { serializeLicenseInput, serializeLicenseUpdateInput } from './client/serialize-input'
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

  constructor({ baseUrl, apiKey, fetch: fetchImplementation }: { baseUrl: string; apiKey: string; fetch?: typeof fetch }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.apiKey = apiKey
    this.fetchImplementation = fetchImplementation ?? fetch
  }

  async createLicense(input: LicenseGateLicenseCreateInput) {
    return requestJson<LicenseGateLicense>(this.fetchImplementation, this.baseUrl, this.apiKey, '/admin/licenses', {
      method: 'POST',
      body: JSON.stringify(serializeLicenseInput(input)),
    })
  }

  async updateLicense(id: number, input: LicenseGateLicenseUpdateInput, currentLicense?: LicenseGateLicense) {
    const current = currentLicense ?? (await this.getLicenseById(id))
    const payload = serializeLicenseUpdateInput(mergeWithCurrentLicense(input, current))

    try {
      return await requestJson<LicenseGateLicense>(this.fetchImplementation, this.baseUrl, this.apiKey, `/admin/licenses/${id}`, {
        method: 'PATCH',
        // El resto de `null` se descarta (la API los rechaza en campos no
        // nulables), pero `expirationDate: null` es una instrucción válida:
        // «quita la fecha». Filtrarlo convertiría un borrado en un no-op.
        body: JSON.stringify(payload, (key, value) =>
          value === null && key !== 'expirationDate' ? undefined : value
        ),
      })
    } catch (error) {
      if (!(error instanceof LicenseGateAdminClientError)) throw error
      throw new LicenseGateAdminClientError(error.message, {
        status: error.status,
        code: error.code,
        details: { requestPayload: payload, responseDetails: error.details },
      })
    }
  }

  async listLicenses() {
    return listAllLicenses(this.fetchImplementation, this.baseUrl, this.apiKey)
  }

  /** Lee una licencia por su clave. El endpoint existe en la API: /admin/licenses/key/{key}. */
  async getLicenseByKey(licenseKey: string) {
    return requestJson<LicenseGateLicense>(
      this.fetchImplementation,
      this.baseUrl,
      this.apiKey,
      `/admin/licenses/key/${encodeURIComponent(licenseKey.trim())}`
    )
  }

  async bulkCreate(
    inputs: LicenseGateLicenseCreateInput[], 
    options: LicenseGateBulkOptions = {})
    : Promise<BulkResult<LicenseGateLicenseCreateInput, LicenseGateLicense>> {
    return runBulk(inputs, (input) => this.createLicense(input), options, this.toClientError)
  }

  async bulkUpdate(inputs: LicenseGateBulkUpdateItem[], options: LicenseGateBulkOptions = {}) {
    const licenses = await this.listLicenses()
    const licenseById = new Map<number, LicenseGateLicense>(licenses.map((license) => [license.id, license]))
    const targetItems = await resolveBulkTargets(inputs, async () => licenses)
    return runBulk(targetItems, (input) => this.updateLicense(input.id, input.data, licenseById.get(input.id)), options, this.toClientError)
  }

  async updateSingleLicense(input: LicenseGateSingleUpdateItem): Promise<LicenseGateLicense> {
    const licenses = await this.listLicenses()
    const targets = await resolveBulkTargets([input], async () => licenses)
    if (targets.length !== 1) throw new LicenseGateAdminClientError(targets.length === 0 ? 'No matching license found for single update' : 'Single update requires exactly one matching license', { status: 0 })
    return this.updateLicense(targets[0].id, targets[0].data, licenses.find((license) => license.id === targets[0].id))
  }

  private async getLicenseById(id: number) {
    const license = (await this.listLicenses()).find((item) => item.id === id)
    if (!license) throw new LicenseGateAdminClientError(`License ${id} not found`, { status: 0 })
    return license
  }

  private toClientError(error: unknown) {
    if (error instanceof LicenseGateAdminClientError) return error
    if (error instanceof Error) return new LicenseGateAdminClientError(error.message, { status: 0 })
    return new LicenseGateAdminClientError('Unknown error', { status: 0, details: error })
  }
}
