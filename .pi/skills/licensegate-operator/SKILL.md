---
name: licensegate-operator
description: >-
  Operate the LicenseGate bulk CLI (license-gate-cli). Use when creating or updating
  customer licenses in the live LicenseGate store via bulk-create, single-update, or
  bulk-update-key-files, when renewing/extending expirations, when setting 8-day
  free-trial expirations, or when reconciling licenses from the licenseKeyFiles CSV
  exports (License Keys.csv + Orders_*.csv). Always dry-runs first and never mutates
  without explicit user confirmation.
---

# LicenseGate operator

You operate `license-gate-cli` for Diego. This tool **mutates real customer
licenses**, so follow the safety protocol exactly.

## Diego's scopes (confirmed 2026-10-13)

- **Free trial:** `RaiderProFreeTrial`, `RPro2-FreeTrial` — expiration = assignment + 8 days.
  (Note the hyphen in `RPro2-FreeTrial`.)
- **Paid:** `RaiderPro`, `RPro2`, `VocalFocus` — leave existing expirations alone; only adjust
  expiration on new updates / custom cases.
- ⚠️ `bulk-update-key-files` only touches assigned keys whose order is **within the last 8
  days** plus available keys. A full historical backfill (all ~705 trial licenses → order
  date + 8 days) is **not** what that command does; it needs a code change or an explicit
  per-license plan, and 685 of those would land in the past (i.e. expire immediately).

## Where everything is

- **Repo root:** `/Users/diegoortega/Documents/GitHub/license-gate-cli`. Always `cd`
  into it before running anything. If it is moved, confirm the path with the user.
- **Default branch:** `feature/agent-operator`.
- **Entry:** `src/cli.ts` · binary after build: `dist/cli.js` (bin `licensegate-bulk`).
- **Run without building:** `npx ts-node src/cli.ts <command> …` from the repo root.
- **Build:** `npm install` then `npm run build`.
- **Examples:** `examples/template.bulk-create.json`, `examples/template.bulk-update.json`,
  `examples/template.single-update.json`.
- **Key files dir (default):** `./licenseKeyFiles` containing `License Keys.csv` and
  `Orders_*.csv`.

## Safety protocol — non-negotiable

1. **Dry-run first, always.** Every command accepts `--dry-run`. Run it, then report the
   resolved target/planned count to the user.
2. **No live mutation without explicit confirmation.** Before a command *without*
   `--dry-run`, state exactly: the command, the input file, the **number of licenses**
   affected, and **what field changes** (e.g. `expirationDate = orderDate + 8 days`).
   Then wait for the user's explicit "yes". A dry-run is not confirmation.
3. **Never invent credentials.** Use `--api-key` only if provided, else rely on
   `LICENSEGATE_API_KEY`. If neither is present, **stop** and ask the user to export it.
   Never print, log, or commit the key.
4. **Always pass `--report <path>` on real runs**, e.g.
   `--report ./reports/<command>-<date>.json`. Read the report back and summarize.
5. **`bulk-update` is interactive and needs a TTY.** It throws
   `bulk-update interactive mode requires a TTY terminal` when run non-interactively.
   Do not try to pipe input to it. Instead: run its `--dry-run`, show targets, and hand
   the live run to the human — or use `single-update` (non-interactive) to test one
   target, or `bulk-update-key-files` (non-interactive) for the key-file flow.
6. **Anything that "removes" or "deactivates" licenses is high risk.** Spell out the
   blast radius and get an explicit confirmation naming the count.
7. If a command exits non-zero, **stop and report** — do not "retry with a tweak" on a
   live store.

## Commands

```
licensegate-bulk bulk-create           --api-key <k> --input <file> [--concurrency <n>] [--dry-run] [--report <file>] [--base-url <url>]
licensegate-bulk bulk-update           --api-key <k> --input <file> [--dry-run] [--report <file>] [--base-url <url>]      # INTERACTIVE
licensegate-bulk bulk-update-key-files --api-key <k> --input <file> [--key-files-dir <dir>] [--dry-run] [--report <file>] [--base-url <url>]
licensegate-bulk single-update         --api-key <k> --input <file> [--dry-run] [--report <file>] [--base-url <url>]
```

- Auth: `--api-key` or env `LICENSEGATE_API_KEY` (required).
- Base URL: `--base-url` or `LICENSEGATE_BASE_URL`, default `https://api.licensegate.io`
  (production unless the user says otherwise).
- `--concurrency` default 5 (bulk-create only). `--key-files-dir` default `./licenseKeyFiles`.
- Exit code `0` = all items succeed; `1` = any failure or invalid command.

## Input formats

### bulk-create — template (recommended) or array

```json
{
  "count": 50,
  "data": {
    "name": "theNameOfYourLicense", "notes": "", "active": true,
    "ipLimit": 1, "validationPoints": 3, "validationLimit": 3,
    "replenishAmount": 1, "replenishInterval": "TEN_SECONDS",
    "expirationDate": { "extendByDays": 8 }, "licenseScope": "YourScope"
  }
}
```

Legacy array format (one object per license) also works. `replenishInterval` ∈
`TEN_SECONDS | MINUTE | HOUR | DAY`.

### bulk-update / single-update — JSON array of `{ scope?, id?, filter?, data }`

```json
[ { "scope": "YOUR_SCOPE", "filter": { "expiredWithinDays": 14 }, "data": { "expirationDate": { "extendByDays": 14 } } } ]
```

- Target by `scope` (`licenseScope`) and/or `id`; `filter` narrows within.
- **Filters** (optional, AND-combined; expiration filters OR-ed with each other):
  `createdWithinDays`, `expiringWithinDays`, `expiredWithinDays`.
- **`data` fields bulk-update applies:** `active`, `licenseKey`, `name`, `notes`,
  `expirationDate`. Other fields are stripped by the bulk normalizer and have no effect.
- **`expirationDate` semantics:** `{ "extendByDays": N }` → `now + N days` (ISO), i.e.
  **from now**, not from current expiration. `null` clears it; a string sets it exactly.

### bulk-update-key-files — non-interactive, CSV-driven

Hard-coded `days = 8`:
- Loads `License Keys.csv` and `Orders_*.csv` from `--key-files-dir`.
- Reads scopes from the input JSON; **input must contain at least one `scope`.**
- **Assigned** keys in those scopes whose order date is within the last 8 days →
  expiration = `assignment date + 8 days`.
- **Available/unassigned** keys in those scopes → expiration = `today + 8 days`.
- ⚠️ Older assigned keys (order older than 8 days) are **left untouched**. If the user
  wants to backfill all historical free trials, that requires a different approach —
  flag it rather than assuming.
- ⚠️ The CSV `tag` column is **not** necessarily the live `licenseScope`. Confirm the
  mapping (e.g. by a read-only list) before trusting it.
- CSV headers:
  - `License Keys.csv` requires `key`, `status`, `order_name`
    (example: `key,tag,status,order_name,created_at`).
  - `Orders_*.csv` requires `order_name`, `date`; `order_number` recommended.

## Output & reports

- `bulk-create` prints `{ command, total, successCount, failureCount, report }` and, with
  `--report`, also writes `<report-name>-keys.txt` (one key per line).
- `bulk-update` prints `{ total, attempted, successCount, failureCount, skippedCount,
  terminatedEarly, failures, report }`.
- `bulk-update-key-files` prints `{ command, plannedCount, updatedCount, failedCount, report }`.
- `single-update` prints `{ command, result }`.
- Dry-runs print `targetCount` (bulk-update), `plannedCount` + `planned[]` (key-files),
  or `items` (create/single).

## Standard operating procedures

**Renew a scope by N days (common job):**
1. Write `input.json`:
   `[ { "scope": "SCOPE", "data": { "expirationDate": { "extendByDays": N } } } ]`.
   Add `"filter": { "expiringWithinDays": M }` to limit to soon-expiring licenses.
2. `npx ts-node src/cli.ts bulk-update --input ./input.json --dry-run` → report `targetCount`.
3. Post the dry-run summary + exact change; wait for the user's explicit yes.
4. Live: the human runs it (interactive), or use `bulk-update-key-files`.
5. Capture and read back `--report`.

**8-day free-trial reconciliation (key-files flow):**
1. Confirm the free-trial `licenseScope` values and that the CSVs are current.
2. Write input JSON with those scopes (no data needed; the command computes expirations).
3. `npx ts-node src/cli.ts bulk-update-key-files --input ./input.json --dry-run` →
   report `plannedCount` and `planned[]`.
4. Confirm, then run live with `--report`, and read the report back.

**Create N licenses:** write the template JSON, dry-run (shows `items`), confirm, live
`bulk-create --concurrency n --report …`, then read the `-keys.txt`.

**Test safely:** `single-update` with a tight filter (e.g. `expiringWithinDays: 1`)
updates exactly one license.

## Analysis notes

- Scope and key matching are case-insensitive and trimmed; order refs normalize
  `Order #1697` → `#1697`.
- A license appearing in neither the CSVs nor a scope is untouched.
- If `plannedCount`/`targetCount` is 0, say so — do **not** invent a mutation.
- Prefer reading `src/` and `README.md` over guessing; the source is the truth.

## Final output format

## What I did
Commands run (verbatim), files written/read (paths).

## Dry-run result
Target/planned count and exactly what would change.

## Result (if a live run happened)
success/failure counts, report path, key-list path if any.

## Needs your decision
Anything awaiting confirmation — with the exact next command and its blast radius.
