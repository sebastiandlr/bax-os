# Radiography API (Current State)

Base: `http://localhost:3000`

All endpoints below are implemented in `apps/landing-engine/src/app/api/radiography/runlog/**`.

Error payloads are normalized to:

```json
{ "ok": false, "error": "<snake_case>", "...optional": "fields" }
```

## Endpoints

## GET `/api/radiography/runlog`

- Query:
  - `limit` (optional, default 20, capped at 100)
- Success `200`:

```json
{
  "ok": true,
  "items": [
    {
      "run_id": "...",
      "created_at": "2026-02-16T00:00:00.000Z",
      "duration_ms": 0,
      "status": "pass|soft_fail|hard_fail|blocked",
      "core_percent": 50,
      "reason_codes": ["needs_manual_verify"],
      "seed_urls_count": 0,
      "unique_hosts_count": 0,
      "source": "local_run|imported_bundle|portable_replay",
      "is_stub": true,
      "top_blockers": ["..."]
    }
  ]
}
```

- Error `500`:
  - `{ "ok": false, "reason": "error", "error": "..." }`

## GET `/api/radiography/runlog/[run_id]`

- Success `200`:
  - `{ "ok": true, "runlog": { ...RadiographyRunLogV0... } }`
- Not found:
  - `404`: `{ "ok": false, "error": "not_found" }`
- Invalid:
  - `400`: `{ "ok": false, "error": "invalid" }`
- Error `500`:
  - `{ "ok": false, "error": "error", "message": "..." }`

## GET `/api/radiography/runlog/evidence/[run_id]`

- Success `200`:
  - `{ "ok": true, "evidence_index": { "run_id", "created_at", "artifacts": [...] } }`
- Errors:
  - `400`: `{ "ok": false, "error": "invalid" }`
  - `404`: `{ "ok": false, "error": "not_found" }`
  - `500`: `{ "ok": false, "error": "error", "message": "..." }`

## GET `/api/radiography/runlog/evidence/[run_id]/artifact/[artifact_id]`

- Success `200`:
  - `{ "ok": true, "artifact": { id, kind, sha256, bytes, created_at, content } }`
- Errors:
  - `400`: `{ "ok": false, "error": "invalid" }`
  - `404`: `{ "ok": false, "error": "not_found" }`
  - `409`: `{ "ok": false, "error": "integrity_mismatch" }`
  - `422`: `{ "ok": false, "error": "artifact_not_json" }`
  - `500`: `{ "ok": false, "error": "error" }`

## GET `/api/radiography/runlog/evidence/[run_id]/bundle`

- Success `200`:
  - JSON file response (not wrapped in `{ ok: true }`)
  - headers:
    - `Content-Type: application/json; charset=utf-8`
    - `Content-Disposition: attachment; filename="radiography-evidence-<run_id>.json"`
- Errors:
  - `400`: `{ "ok": false, "error": "invalid" }`
  - `404`: `{ "ok": false, "error": "not_found" }`
  - `409`: `{ "ok": false, "error": "integrity_mismatch", "artifact_id": "..." }`
  - `413`: `{ "ok": false, "error": "bundle_too_large" }`
  - `422`: `{ "ok": false, "error": "artifact_not_json" }`
  - `500`: `{ "ok": false, "error": "error" }`

## POST `/api/radiography/runlog/evidence/import`

- Request:

```json
{
  "bundle": { "bundle_version": "0.1.0", "run_id": "...", "created_at": "...", "evidence_index": { ... }, "artifacts": [ ... ] }
}
```

- Success `200`:

```json
{
  "ok": true,
  "run_id": "<imported_run_id>",
  "imported": { "artifacts": 3 }
}
```

- Errors:
  - `400`: `invalid` (malformed body/schema/traversal/invalid bundle shape)
  - `409`: `run_already_exists` OR `integrity_mismatch`
  - `413`: `bundle_too_large`
  - `422`: `artifact_not_json`

## POST `/api/radiography/runlog/evidence/replay`

- Request:

```json
{
  "bundle": { "...EvidenceBundleV0..." },
  "options": {
    "strict": true,
    "persist_stub": false,
    "run_id": "optional-when-persisting"
  }
}
```

- Success `200`:

```json
{
  "ok": true,
  "replay": {
    "run_id": "replay-...",
    "gating_decision": { "status": "soft_fail", "core_percent": 50, "reason_codes": ["needs_manual_verify"] },
    "decision_trace": [ ... ]
  },
  "compare": {
    "baseline": { "status": "...", "core_percent": 0, "reason_codes": [] },
    "match": true,
    "diff": {
      "status_changed": false,
      "core_percent_delta": 0,
      "reason_codes": { "added": [], "removed": [] },
      "integrity_warnings": []
    }
  },
  "persisted": {
    "run_id": "...",
    "is_stub": true,
    "source": "portable_replay"
  }
}
```

- Errors:
  - `400`: invalid body/options
  - `409`: `run_already_exists` when `persist_stub=true` collides
  - `413`: `bundle_too_large`
  - `409`: `integrity_mismatch` (strict mode)
  - `5xx`: unhandled server error

## cURL Examples

## Happy path

```bash
# 1) List runs
curl -s "http://localhost:3000/api/radiography/runlog?limit=5"

# 2) Export one bundle
RUN_ID="<existing_run_id>"
curl -s "http://localhost:3000/api/radiography/runlog/evidence/${RUN_ID}/bundle" > /tmp/evidence.bundle.json

# 3) Replay strictly (no writes)
curl -s -X POST "http://localhost:3000/api/radiography/runlog/evidence/replay" \
  -H "content-type: application/json" \
  -d "$(jq -c '{bundle: .}' /tmp/evidence.bundle.json)"

# 4) Import as a new run_id (edit run_id + evidence_index.run_id first)
curl -s -X POST "http://localhost:3000/api/radiography/runlog/evidence/import" \
  -H "content-type: application/json" \
  -d "$(jq -c '{bundle: .}' /tmp/evidence.bundle.import.json)"
```

## Failure examples

```bash
# A) 400 invalid replay request body
curl -s -X POST "http://localhost:3000/api/radiography/runlog/evidence/replay" \
  -H "content-type: application/json" \
  -d '{"bundle":{}}'

# B) 409 strict replay integrity mismatch (tampered bundle metadata)
# (change one artifact sha256 in /tmp/evidence.bundle.json first)
curl -s -X POST "http://localhost:3000/api/radiography/runlog/evidence/replay" \
  -H "content-type: application/json" \
  -d "$(jq -c '{bundle: .}' /tmp/evidence.bundle.tampered.json)"

# C) 409 import collision (same bundle imported twice)
curl -s -X POST "http://localhost:3000/api/radiography/runlog/evidence/import" \
  -H "content-type: application/json" \
  -d "$(jq -c '{bundle: .}' /tmp/evidence.bundle.import.json)"
```
