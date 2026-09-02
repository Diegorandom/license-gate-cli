import {
  type BulkItemResult,
  type BulkResult,
  type LicenseGateBulkOptions,
} from './types'

export async function runBulk<TInput, TOutput>(
  inputs: TInput[],
  handler: (input: TInput, index: number) => Promise<TOutput>,
  options: LicenseGateBulkOptions,
  toClientError: (error: unknown) => Error
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
          error: toClientError(error) as any,
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
