import { runCli } from './cli/run'

runCli().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(message)
  process.exit(1)
})
