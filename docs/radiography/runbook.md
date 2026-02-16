# Radiography Runbook (E2E Smoke)

This runbook validates current evidence portability behavior end-to-end.

Unified error payloads in this runbook use:

```json
{ "ok": false, "error": "<snake_case>", "...optional": "fields" }
```

## Prerequisites

- From repo root:

```bash
npm run check
npm --workspace apps/landing-engine run dev
```

- Keep dev server running on `http://localhost:3000`.

## 1) Get a source run id

```bash
curl -s "http://localhost:3000/api/radiography/runlog?limit=20"
```

Pick one `run_id` as `SRC_RUN_ID`.

Optional status-semantic checks:

```bash
# invalid run_id -> 400
curl -i -s "http://localhost:3000/api/radiography/runlog/.."

# missing run_id -> 404
curl -i -s "http://localhost:3000/api/radiography/runlog/missing01"
```

## 2) Export bundle

```bash
curl -s "http://localhost:3000/api/radiography/runlog/evidence/${SRC_RUN_ID}/bundle" > /tmp/rad.bundle.json
```

## 3) Prepare import id (new run)

Edit `/tmp/rad.bundle.json`:

- set `run_id` to a new id (example: `importsmoke-<timestamp>`)
- set `evidence_index.run_id` to the same new id
- save as `/tmp/rad.bundle.import.json`

## 4) Import bundle

```bash
curl -s -X POST "http://localhost:3000/api/radiography/runlog/evidence/import" \
  -H "content-type: application/json" \
  -d "$(jq -c '{bundle: .}' /tmp/rad.bundle.import.json)"
```

Expected:

- `{ "ok": true, "run_id": "...", "imported": { "artifacts": N } }`

No-`jq` alternative:

```bash
node -e "const fs=require('fs');const b=JSON.parse(fs.readFileSync('/tmp/rad.bundle.import.json','utf8'));fs.writeFileSync('/tmp/import-body.json',JSON.stringify({bundle:b}));"
curl -s -X POST "http://localhost:3000/api/radiography/runlog/evidence/import" \
  -H "content-type: application/json" \
  --data-binary @/tmp/import-body.json
```

## 5) Verify imported stub appears in runlog list

```bash
curl -s "http://localhost:3000/api/radiography/runlog?limit=20"
```

Expected imported item:

- `source: "imported_bundle"`
- `is_stub: true`

## 6) Replay strict (no persistence)

```bash
curl -s -X POST "http://localhost:3000/api/radiography/runlog/evidence/replay" \
  -H "content-type: application/json" \
  -d "$(jq -c '{bundle: .}' /tmp/rad.bundle.import.json)"
```

Expected:

- `ok: true`
- `compare.match: true` (if untampered)
- `compare.baseline_run_id` equals the bundle `run_id`

## 7) Replay non-strict with tampered bundle

Tamper one artifact metadata field (for example first artifact `sha256`) and save as `/tmp/rad.bundle.tampered.json`.

```bash
curl -s -X POST "http://localhost:3000/api/radiography/runlog/evidence/replay" \
  -H "content-type: application/json" \
  -d "$(jq -c '{bundle: ., options: { strict: false }}' /tmp/rad.bundle.tampered.json)"
```

Expected:

- `ok: true`
- `compare.match: false`
- `compare.baseline_run_id` equals the tampered bundle `run_id`
- `compare.diff.integrity_warnings` contains warning ids

## 8) Persist replay stub

```bash
curl -s -X POST "http://localhost:3000/api/radiography/runlog/evidence/replay" \
  -H "content-type: application/json" \
  -d "$(jq -c '{bundle: ., options: { strict: false, persist_stub: true, run_id: "replay-smoke-001" }}' /tmp/rad.bundle.tampered.json)"
```

Expected:

- `ok: true`
- `persisted.run_id: "replay-smoke-001"`
- list endpoint shows run with:
  - `source: "portable_replay"`
  - `is_stub: true`

## 9) Studio smoke

Open `http://localhost:3000/studio` and validate:

- Evidence Bundle section:
  - download bundle from selected run
  - import bundle draft
- Evidence Replay section:
  - source = bundle draft and selected run
  - strict/non-strict options
  - replay summary rendered
  - replay persist auto-selects new stub in run list

## Troubleshooting

## “409 on import/replay persist”

Meaning:

- target `run_id` already exists as a runlog/stub

Action:

- change `bundle.run_id` and `bundle.evidence_index.run_id` before import
- for replay persist, provide a new `options.run_id`

## “409 integrity_mismatch” during strict replay

Meaning:

- artifact metadata/content hash/bytes mismatch (bundle tampered or inconsistent)

Action:

- retry with untampered bundle
- or intentionally set `strict=false` for diagnostic replay only

Note:

- strict replay integrity mismatches now return HTTP `409` with:
  - `{ "ok": false, "error": "integrity_mismatch", ... }`

## Hydration mismatch in Studio

This is usually UI/runtime/environment noise (browser extension injection, stale client cache), not runlog determinism.

Isolation steps:

- hard refresh
- disable extensions for localhost
- open an incognito/private window

## `.next/dev/lock` issues

If dev server fails to start with lock-file contention:

- stop any existing `next dev` process
- remove stale lock file if needed:

```bash
rm -f apps/landing-engine/.next/dev/lock
```

Then restart dev server.

## Leak smoke check

```bash
curl -s "http://localhost:3000/api/radiography/runlog?limit=5" > /tmp/rad.list.json
rg -n '/Users/|\\\\Users\\\\|\.bax/runlogs|https?://' /tmp/rad.list.json
```

Expected: no matches.
