# Radiography CLI (Current State)

CLI scripts live in `apps/landing-engine/scripts/radiography/` and are exposed by `apps/landing-engine/package.json`.

## Available Scripts

- `npm --workspace apps/landing-engine run radiography:evidence -- --run_id=<RUN_ID>`
  - Calls: `scripts/radiography/evidence.mjs`
  - Reads evidence index and prints artifact summary table.
- `npm --workspace apps/landing-engine run radiography:evidence:artifact -- <RUN_ID> <ARTIFACT_ID> [--port 3000]`
  - Calls: `scripts/radiography/evidence-artifact.mjs`
  - Fetches one artifact JSON.
- `npm --workspace apps/landing-engine run radiography:evidence:bundle -- <RUN_ID> --out /tmp/bundle.json [--port 3000]`
  - Calls: `scripts/radiography/evidence-bundle.mjs export`
  - Exports bundle JSON.
- `npm --workspace apps/landing-engine run radiography:evidence:import -- /tmp/bundle.json [--port 3000]`
  - Calls: `scripts/radiography/evidence-bundle.mjs import`
  - Imports bundle.
- `npm --workspace apps/landing-engine run radiography:evidence:replay -- /tmp/bundle.json [--port 3000] [--persist] [--run-id <id>] [--no-strict]`
  - Calls: `scripts/radiography/evidence-replay.mjs`
  - Replays bundle with strict/non-strict + optional persisted stub.

## Environment Options

- `PORT` (default `3000`)
- `RADIOGRAPHY_API_BASE` (overrides `http://localhost:<PORT>`)

## Typical Workflow

```bash
# 1) choose a run
npm --workspace apps/landing-engine run radiography:evidence -- --run_id=<RUN_ID>

# 2) export a bundle
npm --workspace apps/landing-engine run radiography:evidence:bundle -- <RUN_ID> --out /tmp/rad.bundle.json

# 3) inspect one artifact
npm --workspace apps/landing-engine run radiography:evidence:artifact -- <RUN_ID> <ARTIFACT_ID>

# 4) replay strict (no writes)
npm --workspace apps/landing-engine run radiography:evidence:replay -- /tmp/rad.bundle.json

# 5) replay non-strict + persist stub
npm --workspace apps/landing-engine run radiography:evidence:replay -- /tmp/rad.bundle.json --no-strict --persist --run-id replay-demo-001

# 6) import bundle
npm --workspace apps/landing-engine run radiography:evidence:import -- /tmp/rad.bundle.json
```

## Expected Output Patterns

- Success prints JSON with `ok: true`.
- Failure prints JSON with `ok: false` and exits non-zero.
- Bundle export prints:
  - output file path
  - `run_id=<...> artifacts=<N>`

## Leak Smoke Checks

Use this after API/CLI calls saved to a file:

```bash
rg -n '/Users/|\\\\Users\\\\|\.bax/runlogs|https?://' /tmp/radiography-output.json
```

Expected: no matches.

Notes:
- Some test payloads intentionally contain URLs before sanitization, but persisted runlogs/evidence should not.
- Artifact content in API responses is already sanitized server-side.
