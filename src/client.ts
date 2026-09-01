export type ReplenishInterval = 'TEN_SECONDS' | 'MINUTE' | 'HOUR' | 'DAY'

export interface LicenseGateLicense {
  id: number
  active: boolean
  userId: number
  licenseKey: string
  name: string
  notes: string
  ipLimit: number | null
  licenseScope: string | null
  expirationDate: string | null
  validationPoints: number | null
  validationLimit: number | null
  replenishAmount: number | null
  replenishInterval: ReplenishInterval | null
  createdAt: string
}

export interface LicenseGateLicenseCreateInput {
  name: string
  notes: string
  active: boolean
  ipLimit?: number | null
  licenseScope?: string | null
  expirationDate?: string | Date | null
  validationPoints?: number | null
  validationLimit?: number | null
  replenishAmount?: number | null
  replenishInterval?: ReplenishInterval | null
  licenseKey?: string
}

export interface LicenseGateLicenseUpdateInput {
  active?: boolean
  licenseKey?: string
  name?: string
  notes?: string
  ipLimit?: number | null
  licenseScope?: string | null
  expirationDate?: string | Date | null
  validationPoints?: number | null
  validationLimit?: number | null
  replenishAmount?: number | null
  replenishInterval?: ReplenishInterval | null
}

export interface LicenseGateBulkUpdateItem {
  id: number
  data: LicenseGateLicenseUpdateInput
}

export interface LicenseGateBulkOptions {
  concurrency?: number
}

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

export type BulkItemResult<TInput, TOutput> =
  | { index: number; input: TInput; success: true; data: TOutput }
  | { index: number; input: TInput; success: false; error: LicenseGateAdminClientError }

export interface BulkResult<TInput, TOutput> {
  total: number
  successCount: number
  failureCount: number
  results: Array<BulkItemResult<TInput, TOutput>>
}

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
    return this.request<LicenseGateLicense>('/admin/licenses', {
      method: 'POST',
      body: JSON.stringify(this.serializeLicenseInput(input)),
    })
  }

  async updateLicense(id: number, input: LicenseGateLicenseUpdateInput) {
    return this.request<LicenseGateLicense>(`/admin/licenses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(this.serializeLicenseInput(input)),
    })
  }

  async bulkCreate(
    inputs: LicenseGateLicenseCreateInput[],
    options: LicenseGateBulkOptions = {}
  ): Promise<BulkResult<LicenseGateLicenseCreateInput, LicenseGateLicense>> {
    return this.runBulk(inputs, (input) => this.createLicense(input), options)
  }

  async bulkUpdate(
    inputs: LicenseGateBulkUpdateItem[],
    options: LicenseGateBulkOptions = {}
  ): Promise<BulkResult<LicenseGateBulkUpdateItem, LicenseGateLicense>> {
    return this.runBulk(inputs, (input) => this.updateLicense(input.id, input.data), options)
  }

  private async runBulk<TInput, TOutput>(
    inputs: TInput[],
    handler: (input: TInput, index: number) => Promise<TOutput>,
    options: LicenseGateBulkOptions
  ): Promise<BulkResult<TInput, TOutput>> {
    const concurrency = Math.max(1, Math.floor(options.concurrency ?? 5))
    const results: Array<BulkItemResult<TInput, TOutput>> = new Array(inputs.length)
    let cursor = 0

    const worker = async () => {
      while (true) {
        const currentIndex = cursor++
        if (currentIndex >= inputs.length) return

        const input = inputs[currentIndex]

        try {
          const data = await handler(input, currentIndex)
          results[currentIndex] = { index: currentIndex, input, success: true, data }
        } catch (error) {
          results[currentIndex] = {
            index: currentIndex,
            input,
            success: false,
            error: this.toClientError(error),
          }
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, () => worker()))

    const successCount = results.filter((result) => result.success).length
    return {
      total: inputs.length,
      successCount,
      failureCount: inputs.length - successCount,
      results,
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })

    if (!response.ok) {
      throw await this.createError(response)
    }

    return (await response.json()) as T
  }

  private async createError(response: Response) {
    const contentType = response.headers.get('content-type') ?? ''

    if (contentType.startsWith('application/json')) {
      const payload = (await response.json()) as {
        error?: string
        message?: string
        details?: unknown
      }

      return new LicenseGateAdminClientError(
        payload.message ?? this.detailsToMessage(payload.details) ?? response.statusText,
        {
          status: response.status,
          code: payload.error,
          details: payload.details,
        }
      )
    }

    return new LicenseGateAdminClientError(await response.text(), {
      status: response.status,
    })
  }

  private detailsToMessage(details: unknown) {
    if (typeof details === 'string') return details
    return undefined
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
}
