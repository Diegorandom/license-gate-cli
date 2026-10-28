---
name: licensegate-operator
description: >-
  Operate the LicenseGate bulk CLI (license-gate-cli). Use when creating or updating
  licenses in a live LicenseGate store via bulk-create, single-update, or
  bulk-update-key-files, when renewing/extending expirations, when setting 8-day
  free-trial expirations, or when reconciling licenses from the licenseKeyFiles CSV
  exports (License Keys.csv + Orders_*.csv). Always dry-runs first and never mutates
  without explicit user confirmation.
---

# LicenseGate operator

You operate `license-gate-cli` for the user. This tool **mutates real licenses**, so
follow the safety protocol exactly. Keep secrets out of logs, commits, and command lines.

## License scopes & trial rules

- `licenseScope` values are **project-specific**. Confirm the exact scope names with the
  operator for each job; do not assume them. Matching is case-insensitive and trimmed.
- **Free-trial** scopes use an **8-day** expiration measured from the assignment (order)
  date.
- **Paid** scopes keep their existing expirations unless the operator explicitly asks for
  a change.
- ⚠️ `bulk-update-key-files` only touches assigned keys whose order is **within the last 8
  days** plus available keys. A full historical backfill (every trial license → order date
  + 8 days) is **not** what that command does; it needs a code change or an explicit
  per-license plan, and older orders would land in the past (i.e. expire immediately).

## Where everything is

- **Repo root:** run every command from the root of this repository (the directory that
  contains `package.json` and `src/`). `cd` into it first.
- **Entry:** `src/cli.ts` · binary after build: `dist/cli.js` (bin `licensegate-bulk`).
- **Run without building:** `npx ts-node src/cli.ts <command> …` from the repo root.
- **Build:** `npm install` then `npm run build`.
- **Examples:** `examples/template.bulk-create.json`, `examples/template.bulk-update.json`,
  `examples/template.single-update.json`.
- **Key files dir (default):** `./licenseKeyFiles`, containing:
  - the license-keys export, whose **exact expected name is `License Keys.csv`** (loader
    constant `LICENSE_KEYS_FILE`); on a case-insensitive filesystem `License keys.csv` still
    resolves, so don't rename the export just for casing.
  - the orders export, which must match **`/^Orders_.*\.csv$/i`** — it needs the `Orders_`
    prefix. A file named plain `Orders.csv` fails with `Orders CSV not found in …`.
    Rename/copy to e.g. `Orders_.csv` (keep the original too) instead of editing code.

## Setup & environment

- **Install deps before the first `npx ts-node`.** A bare checkout has no `node_modules`;
  `npx` then pulls a mismatched `ts-node` and dies with
  `TypeError: Cannot read properties of undefined (reading 'fileExists')`.
  Fix: `npm install` once from the repo root.
- **Non-interactive tool shells don't load your shell profile.** If the key is defined in a
  profile (e.g. `~/.zshrc`, `~/.bashrc`, `~/.zprofile`), source it for the command:
  `set -a && source <profile> && set +a && npx ts-node src/cli.ts …`
  This loads the key in-process only. Never `echo` it and never pass `--api-key` on the
  command line (it leaks into shell history / the process list). If verification is
  requested, reveal at most first/last 3 characters of `$LICENSEGATE_API_KEY`.
- **Auth is required even for `--dry-run`.** `bulk-create --dry-run` makes **no** API call
  (it only counts items) but still exits `Missing --api-key or LICENSEGATE_API_KEY` without
  a key. `bulk-update` and `bulk-update-key-files` dry-runs **do** call `listLicenses()`
  (read-only, cheap, allowed).
- **Production by default:** `https://api.licensegate.io`. Do not pass `--base-url` unless
  the user explicitly wants a non-prod store.
- **Date/timezone:** order dates like `2026-01-15 09:30` are parsed by `new Date()` as
  **local** time; expirations are emitted as ISO/UTC. When reasoning about "today", state
  the assumption (machine clock, UTC).

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
  **from now**, not from current expiration. A string sets it exactly.
- ⚠️ **`null` does NOT clear the date via this API** (measured 2026-10-28, HTTP 422
  `invalid ISO 8601 datetime format`). The REST schema requires an ISO string on both
  create and update, so **a truly expiring-free license cannot be created or patched
  through the API** — the ones that exist (dashboard-made) are also **unpatchable**,
  because their `ipLimit`/`validationPoints`/`validationLimit` are null and the schema
  demands numbers. Practical convention for "perpetual": a far-future ISO date, e.g.
  `2099-12-31T23:59:59.000Z`.
- **`bulk-update --yes [--max N]`** runs non-interactively (no TTY needed) and aborts
  if the resolved plan exceeds N (default 50). Use it for scripted batches; the
  interactive path stays the default.

### bulk-update-key-files — non-interactive, CSV-driven

Hard-coded `days = 8`:
- Loads `License Keys.csv` and `Orders_*.csv` from `--key-files-dir`.
- Reads scopes from the input JSON; **input must contain at least one `scope`.**
- **Assigned** keys in those scopes whose order date is within the last 8 days →
  expiration = `assignment date + 8 days`.
- **Available/unassigned** keys in those scopes → expiration = `today + 8 days`.
- ⚠️ **`plannedCount` includes BOTH categories.** The available branch is not optional and
  there is no flag to exclude it. If the user only asked about *assigned* keys, spell out
  the available count and get explicit sign-off on it too (a code change is needed to
  restrict to assigned-only).
- ⚠️ Older assigned keys (order older than 8 days) are **left untouched**; so are rows whose
  `order_name` doesn't resolve to a row in `Orders_*.csv`. A full historical backfill is a
  different job — flag it rather than assuming.
- ⚠️ **Boundary nuance:** expiration = `orderDate + 8 days`, so a key ordered just under 8
  days ago can land **< 24h from now** (i.e. *not* "at least a day"). Surface those ids and
  confirm the user accepts it (they did receive a full 8-day trial).
- ⚠️ The CSV `tag` column is **ignored by the planner.** Matching keys on the **live
  `licenseScope`**, case-insensitively, against the scopes in the input JSON. A tag can also
  disagree with the live scope (case, spacing, or a missing hyphen). Never derive the input
  scope from the tag.
- CSV headers:
  - `License Keys.csv` requires `key`, `status`, `order_name`
    (example: `key,tag,status,order_name,created_at`).
  - `Orders_*.csv` requires `order_name`, `date`; `order_number` recommended.

## Output & reports

- `bulk-create` prints `{ command, total, successCount, failureCount, report }` and, with
  `--report`, also writes a sibling key list
  **`<report-basename-without-.json>-keys.txt`** (one key per line, **no trailing newline**
  — count with `grep -c .`, not `wc -l`). Example: report `…/foo-2026-01-01.json` → keys
  `…/foo-2026-01-01-keys.txt`. The report JSON also carries `createdLicenseKeys[]`.
- Treat the `-keys.txt` file as a live secret (hand it to the customer; don't commit).
- `bulk-update` prints `{ total, attempted, successCount, failureCount, skippedCount,
  terminatedEarly, failures, report }`.
- `reactivate` prints `{ id, scope, key, from, baseForExtension, to, days, applied }` and
  is **dry-run unless `--yes`**. It reads the license by key (`/admin/licenses/key/{key}`)
  and extends from `max(now, current expiry) + days`.
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

## End-to-end worked examples

### Example A — create N free-trial licenses for a scope

Objective: "create 50 licenses for scope `<FREE_TRIAL_SCOPE>`."

1. Write `reports/create-<scope>-50.input.json`:
   ```json
   { "count": 50, "data": { "name": "<License Name>", "notes": "", "active": true,
     "ipLimit": 1, "validationPoints": 3, "validationLimit": 3, "replenishAmount": 1,
     "replenishInterval": "TEN_SECONDS", "expirationDate": { "extendByDays": 8 },
     "licenseScope": "<FREE_TRIAL_SCOPE>" } }
   ```
2. Dry-run (no API call, but needs auth):
   ```bash
   npx ts-node src/cli.ts bulk-create --input ./reports/create-<scope>-50.input.json --dry-run
   ```
   → `{ command:"bulk-create", baseUrl:"https://api.licensegate.io", items:50,
   concurrency:5, dryRun:true }`
3. Show the exact per-license payload + count, wait for an explicit **yes**, then live:
   ```bash
   npx ts-node src/cli.ts bulk-create --input ./reports/create-<scope>-50.input.json \
     --concurrency 5 --report ./reports/bulk-create-<scope>-<date>.json
   ```
   → `{ total:50, successCount:50, failureCount:0 }`, exit 0.
4. Read back: all-success count; sample `expirationDate ≈ now+8d`; keys file has the
   expected number of unique keys (`grep -c .`).

### Example B — standard 8-day free-trial reconciliation (key-files flow)

Objective: "update the currently assigned keys so each trial lasts the full 8 days."

1. Ensure `licenseKeyFiles/` has `License Keys.csv` + an `Orders_*.csv`.
2. Input `reports/free-trials.input.json`:
   ```json
   [ { "scope": "<FREE_TRIAL_SCOPE_A>", "data": {} },
     { "scope": "<FREE_TRIAL_SCOPE_B>", "data": {} } ]
   ```
3. Dry-run (calls `listLicenses()`, read-only):
   ```bash
   npx ts-node src/cli.ts bulk-update-key-files --input ./reports/free-trials.input.json \
     --key-files-dir ./licenseKeyFiles --dry-run > reports/key-files-dryrun-<date>.json
   ```
   → `plannedCount:<N>` = `<a>` `ASSIGNED_WITHIN_WINDOW` + `<b>` **`AVAILABLE`**. Report the
   split, flag the available side effect and any <24h boundary keys, wait for explicit yes.
4. Live:
   ```bash
   npx ts-node src/cli.ts bulk-update-key-files --input ./reports/free-trials.input.json \
     --key-files-dir ./licenseKeyFiles --report ./reports/bulk-update-key-files-<date>.json
   ```
   → `{ plannedCount:<N>, updatedCount:<N>, failedCount:0 }`, exit 0.
5. Read back: unique ids, expiration range, `failures:[]`.

**Pitfalls to expect:** missing `node_modules`; a non-interactive shell not loading the
profile that holds the key; `Orders.csv` vs `Orders_*.csv`; the available-branch side
effect; tag-vs-live-scope case/hyphen mismatch.

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
