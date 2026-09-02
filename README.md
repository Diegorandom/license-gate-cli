# licensegate-bulk-cli

Standalone Node/TypeScript CLI for bulk license creation and bulk updates against an existing LicenseGate backend.

## Features

- `bulk-create`
- `bulk-update`
- `single-update`
- JSON input files
- configurable concurrency
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

- `--base-url` or `LICENSEGATE_BASE_URL`
- `--api-key` or `LICENSEGATE_API_KEY`

The base URL should be the backend origin that exposes `/admin/licenses`.

## Usage

### Dry run

- `npx ts-node src/cli.ts bulk-create --base-url https://your-licensegate-backend.example.com --input ./examples/bulk-create.json --dry-run`

### Bulk create

- `npx ts-node src/cli.ts bulk-create --base-url https://your-licensegate-backend.example.com --api-key YOUR_API_KEY --input ./examples/bulk-create.json --concurrency 5 --report ./reports/create-report.json`

### Bulk update

- `npx ts-node src/cli.ts bulk-update --base-url https://your-licensegate-backend.example.com --api-key YOUR_API_KEY --input ./examples/bulk-update.json --concurrency 5 --report ./reports/update-report.json`

### Single update for testing

- `npx ts-node src/cli.ts single-update --base-url https://your-licensegate-backend.example.com --api-key YOUR_API_KEY --input ./examples/single-update.json --report ./reports/single-update-report.json`

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
      "expiredWithinDays": 7,
      "activatedAtLeastOnce": false
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
