export type Command = 'bulk-create' | 'bulk-update' | 'single-update' | 'bulk-update-key-files'

export interface CliOptions {
  command: Command
  baseUrl: string
  apiKey: string
  input: string
  keyFilesDir: string
  concurrency: number
  dryRun: boolean
  report?: string
}
