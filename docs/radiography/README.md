# Radiography Docs (Current State)

This section documents the implementation-derived behavior for Radiography runlogs and evidence portability in `bax-os`.

## Documents

- [`docs/radiography/evidence-portability.md`](./evidence-portability.md)
- [`docs/radiography/api.md`](./api.md)
- [`docs/radiography/cli.md`](./cli.md)
- [`docs/radiography/security-model.md`](./security-model.md)
- [`docs/radiography/runbook.md`](./runbook.md)
- ADR rationale:
  - [`docs/adr/ADR-001-radiography-evidence-portability-v0.md`](../adr/ADR-001-radiography-evidence-portability-v0.md)

## Quickstart

```bash
# 1) Gates
npm run check

# 2) Start app
npm --workspace apps/landing-engine run dev

# 3) Pick a run id
curl -s "http://localhost:3000/api/radiography/runlog?limit=5"

# 4) Export bundle
RUN_ID="<existing_run_id>"
curl -s "http://localhost:3000/api/radiography/runlog/evidence/${RUN_ID}/bundle" > /tmp/rad.bundle.json

# 5) Replay strict (untampered: expect 200)
curl -s -X POST "http://localhost:3000/api/radiography/runlog/evidence/replay" \
  -H "content-type: application/json" \
  -d "$(jq -c '{bundle: .}' /tmp/rad.bundle.json)"

# 6) Replay strict tampered (expect 409 integrity_mismatch)
curl -s -X POST "http://localhost:3000/api/radiography/runlog/evidence/replay" \
  -H "content-type: application/json" \
  -d "$(jq -c '{bundle: .}' /tmp/rad.bundle.tampered.json)"

# 7) Import (expect 200)
curl -s -X POST "http://localhost:3000/api/radiography/runlog/evidence/import" \
  -H "content-type: application/json" \
  -d "$(jq -c '{bundle: .}' /tmp/rad.bundle.import.json)"

# 8) Import collision (expect 409 run_already_exists)
curl -s -X POST "http://localhost:3000/api/radiography/runlog/evidence/import" \
  -H "content-type: application/json" \
  -d "$(jq -c '{bundle: .}' /tmp/rad.bundle.import.json)"
```

## Where to Look in Code/Tests

- `apps/landing-engine/src/lib/radiography/runlogUtils.ts`
- `apps/landing-engine/src/lib/radiography/runlogStorage.ts`
- `apps/landing-engine/src/app/api/radiography/runlog/**`
- `apps/landing-engine/tests/runlog/runlog.golden.test.ts`

## API Semantics Snapshot

Current normalized semantics:

- `not_found` -> `404`
- `invalid` -> `400`
- `integrity_mismatch` -> `409`
- `artifact_not_json` -> `422`
- `bundle_too_large` -> `413`
- `run_already_exists` -> `409`
- server failures -> `500`

Unified error payload:

```json
{ "ok": false, "error": "<snake_case>", "...optional": "fields" }
```

For decision rationale and tradeoffs, see ADR-001:

- [`docs/adr/ADR-001-radiography-evidence-portability-v0.md`](../adr/ADR-001-radiography-evidence-portability-v0.md)
