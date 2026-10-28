export type Command = 'bulk-create' | 'bulk-update' | 'single-update' | 'bulk-update-key-files' | 'reactivate'

export interface CliOptions {
  command: Command
  baseUrl: string
  apiKey: string
  input: string
  keyFilesDir: string
  concurrency: number
  dryRun: boolean
  report?: string
  /** `--yes`: ejecuta `bulk-update` sin la capa interactiva (pide TTY). */
  yes?: boolean
  /** `--max`: tope duro de objetivos para `--yes`. Si el plan lo supera, aborta. */
  maxTargets?: number
  /** `reactivate --key`: la clave que el cliente tiene en la mano. */
  key?: string
  /** `reactivate --days`: días a añadir desde ahora. 30 por defecto. */
  days?: number
}
