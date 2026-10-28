<img width="3024" height="1890" alt="license-gate-cli diagram (1)" src="https://github.com/user-attachments/assets/5b3b2328-f7c6-43ac-9e06-08315b34054a" />

# licensegate-bulk-cli

Standalone Node/TypeScript CLI for bulk license creation and bulk updates against an existing [LicenseGate](https://licensegate.io/) backend.

## Features

- `bulk-create`
- `bulk-update` (interactive per-license confirmation)
- `single-update`
- JSON input files
- dry-run mode
- optional JSON report output
- no dependency on the LicenseGate frontend/backend runtime

## Agent skill

This repository ships an [Agent Skills](https://agentskills.io/specification) definition
for operating the CLI safely:

- `.agents/skills/licensegate-operator/SKILL.md`

It documents the safety protocol (dry-run first, explicit confirmation before live
mutations), the command/flag reference, input formats, the `bulk-update-key-files` CSV
rules, and end-to-end worked examples. Agent harnesses that support the Agent Skills
spec (Pi and others) discover it automatically when working in this repository; it can
also be read directly.

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

`bulk-update --yes [--max N]` runs the same job non-interactively (for scripted batches):
it resolves the targets first and **aborts if they exceed `--max`** (default 50). The
interactive path below stays the default.

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
- targets assigned keys in those scopes with order assignment date in last 8 days
- sets expiration date to assignment date + 8 days
- targets available/unassigned keys in those scopes and sets expiration date to today + 8 days

Expected CSV headers:

- `License Keys.csv` (required columns):
  - `key`
  - `status`
  - `order_name`

  Example header:
  - `key,tag,status,order_name,created_at`

- `Orders_*.csv` (required columns):
  - `order_name`
  - `date`

  Optional but recommended:
  - `order_number` (improves matching for values like `Order #1697`)

  Example header:
  - `order_number,order_name,customer,email,products,date`

### Reactivate one license (by key)

- `npx ts-node src/cli.ts reactivate --key LICENSE_KEY [--days 30] [--yes] [--report f.json]`

Extends a customer's license **from its current expiry** when that expiry is still in
the future, or from now when it has already lapsed — so renewing early never costs the
remaining days. **Dry-run by default**: without `--yes` it only prints the before/after.

### Single update for testing

- `npx ts-node src/cli.ts single-update --api-key YOUR_API_KEY --input ./examples/template.single-update.json --report ./reports/single-update-report.json`

## Input format

### bulk-create

You can provide either:

1) JSON array of payloads (legacy format), or
2) single template format with `count` + `data` (recommended)

Single template format:

    {
      "count": 50,
      "data": {
        "name": "theNameOfYourLicense",
        "notes": "",
        "active": true,
        "ipLimit": 1,
        "validationPoints": 3,
        "validationLimit": 3,
        "replenishAmount": 1,
        "replenishInterval": "TEN_SECONDS",
        "expirationDate": {
          "extendByDays": 8
        },
        "licenseScope": "YourScope"
      }
    }

This creates 50 licenses with the same settings.

Legacy array format still works:

    [
      {
        "name": "Customer A",
        "notes": "",
        "active": true
      }
    ]

### bulk-update

Use `scope` to update all licenses that share a `licenseScope`. Set `data.expirationDate` to `{ "extendByDays": <number> }` to choose how many days to add from when the script runs.

Example: renew all licenses in `YOURSCOPE` by 14 days:

    [
      {
        "scope": "YOURSCOPE",
        "data": {
          "expirationDate": {
            "extendByDays": 14
          }
        }
      }
    ]

### single-update

Use this to update one matching license for testing. It accepts the same scope/filter structure, but the command stops after resolving one target.

Example:

    [
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
    ]

## Exit code

- `0` when all items succeed
- `1` when any item fails or the command is invalid
