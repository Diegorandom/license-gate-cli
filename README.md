# licensegate-bulk-cli

Standalone Node/TypeScript CLI for bulk license creation and bulk updates against an existing LicenseGate backend.

## Features

- `bulk-create`
- `bulk-update` (interactive per-license confirmation)
- `single-update`
- JSON input files
- dry-run mode
- optional JSON report output
- no dependency on the LicenseGate frontend/backend runtime

## Requirements

- Node.js 18+

## Install

From this folder:

- `npm install`
- `npm run build`

## Configuration

Pass values as flags or environment variables:

- `--api-key` or `LICENSEGATE_API_KEY`
- `--base-url` or `LICENSEGATE_BASE_URL` (optional, defaults to `https://api.licensegate.io`)

## Usage

### Dry run

- Bulk create dry run:
  - `npx ts-node src/cli.ts bulk-create --api-key YOUR_API_KEY --input ./examples/template.bulk-create.json --dry-run`
- Bulk update dry run (resolves real targets and returns `targetCount`):
  - `npx ts-node src/cli.ts bulk-update --api-key YOUR_API_KEY --input ./examples/template.bulk-update.json --dry-run`
- Bulk update from key files dry run (returns `plannedCount`):
  - `npx ts-node src/cli.ts bulk-update-key-files --api-key YOUR_API_KEY --input ./examples/template.bulk-update.json --key-files-dir ./licenseKeyFiles --dry-run`

### Bulk create

- `npx ts-node src/cli.ts bulk-create --api-key YOUR_API_KEY --input ./examples/template.bulk-create.json --concurrency 5 --report ./reports/create-report.json`

### Bulk update

- `npx ts-node src/cli.ts bulk-update --api-key YOUR_API_KEY --input ./examples/template.bulk-update.json --report ./reports/update-report.json`

`bulk-update` is interactive:
- `y` / `yes`: update this license
- `n` / `no`: skip this license
- `q` / `quit`: stop processing more licenses
- `f` / `fast-forward`: update all remaining licenses without further prompts
- after choosing update, you can optionally set a custom expiration extension (days from now) for that license

### Bulk update from license key files

- `npx ts-node src/cli.ts bulk-update-key-files --api-key YOUR_API_KEY --input ./examples/template.bulk-update.json --key-files-dir ./licenseKeyFiles --report ./reports/key-files-update-report.json`

Rules for `bulk-update-key-files`:
- loads `License Keys.csv` and `Orders_*.csv` from `--key-files-dir`
- reads scopes from the input JSON (`scope` values)
- targets only assigned keys in those scopes with order assignment date in last 8 days
- sets expiration date to assignment date + 8 days

### Single update for testing

- `npx ts-node src/cli.ts single-update --api-key YOUR_API_KEY --input ./examples/template.single-update.json --report ./reports/single-update-report.json`

## Input format

### bulk-create

JSON array of license payloads:

`[
  {
    "name": "Customer A",
    "notes": "",
    "active": true
  }
]`

### bulk-update

Use `scope` to update all licenses that share a `licenseScope`. Set `data.expirationDate` to `{ "extendByDays": <number> }` to choose how many days to add from when the script runs.

Example: renew all licenses in `YOURSCOPE` by 14 days:

`[
  {
    "scope": "YOURSCOPE",
    "data": {
      "expirationDate": {
        "extendByDays": 14
      }
    }
  }
]`

### single-update

Use this to update one matching license for testing. It accepts the same scope/filter structure, but the command stops after resolving one target.

Example:

`[
  {
    "scope": "YOURSCOPE",
    "filter": {
      "expiredWithinDays": 7
    },
    "data": {
      "expirationDate": {
        "extendByDays": 7
      }
    }
  }
]`

## Exit code

- `0` when all items succeed
- `1` when any item fails or the command is invalid
