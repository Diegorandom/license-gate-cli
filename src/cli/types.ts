export type Command = 'bulk-create' | 'bulk-update' | 'single-update'

export interface CliOptions {
  command: Command
  baseUrl: string
  apiKey: string
  input: string
  concurrency: number
  dryRun: boolean
  report?: string
}
