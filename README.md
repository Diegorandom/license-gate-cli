# licensegate-bulk-cli

Standalone Node/TypeScript CLI for bulk license creation and bulk updates against an existing LicenseGate backend.

## Features

- `bulk-create`
- `bulk-update`
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

JSON array of update operations:

`[
  {
    "id": 123,
    "data": {
      "active": false
    }
  }
]`

## Exit code

- `0` when all items succeed
- `1` when any item fails or the command is invalid
