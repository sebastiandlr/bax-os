# ADR-001: Radiography Evidence Portability v0

Status: Accepted (implemented)
Date: 2026-02-16

## Decision Summary

We standardize Radiography evidence portability around file-backed, deterministic flows:

- Evidence bundles are portable JSON packages.
- Bundle import persists evidence files and creates a runlog stub.
- Portable replay supports:
  - strict integrity mode (fail on mismatch)
  - non-strict mode (deterministic degraded replay)
  - optional persisted replay stub.

## Deterministic Replay `run_id` Strategy

Portable replay derives a deterministic `run_id` when not explicitly provided:

- based on bundle identity inputs, including bundle `run_id` and stable hashing of bundle JSON content.
- output is normalized into a valid run id pattern.

Why deterministic:

- auditable reproducibility
- stable compare behavior
- predictable client-side/state handling across repeated replays.

## Status Semantics (Current Implementation)

Across radiography runlog/evidence endpoints:

- `not_found` -> `404`
- `invalid` -> `400`
- `integrity_mismatch` -> `409` (including strict replay)
- `artifact_not_json` -> `422`
- `bundle_too_large` -> `413`
- `run_already_exists` -> `409`
- unexpected server failure -> `500`

Unified error body:

```json
{ "ok": false, "error": "<snake_case>", "...optional": "fields" }
```

## Tradeoffs

Benefits:

- simpler and predictable client error handling
- alignment between import/export/replay semantics
- easier ops debugging and test assertions.

Costs:

- existing clients that depended on `reason` payload keys need adaptation
- strict `integrity_mismatch` as `409` (instead of `422`) is a semantic choice favoring conflict semantics over validation semantics.

## Follow-ups

- Replay response includes `compare.baseline_run_id`, set deterministically to the replay bundle `run_id` for provenance clarity.
- Consider ADR-002 for bundle schema versioning and forward compatibility policy.
