# Radiography Security Model (Current State)

This model covers runlog + evidence portability endpoints and Studio interactions.

## Threat Model

## 1) Path traversal / filesystem escape

- Risk:
  - Attacker-controlled `run_id` / `artifact_id` / paths could target files outside `.bax/`.
- Mitigations:
  - Regex validation:
    - `RUNLOG_RUN_ID_PATTERN`
    - `EVIDENCE_ARTIFACT_ID_PATTERN`
  - Boundary checks:
    - `isPathInsideDir(...)`
    - `getEvidenceDirForRun(...)`
    - `getRunLogPath(...)`
  - Storage prune boundary:
    - `isPathInsideRunLogDir(...)`
- Code:
  - `apps/landing-engine/src/lib/radiography/runlogUtils.ts`
  - `apps/landing-engine/src/lib/radiography/runlogStorage.ts`

## 2) Integrity tampering (metadata/content mismatch)

- Risk:
  - Artifact file or bundle payload altered after generation.
- Mitigations:
  - Recompute `sha256` + `bytes` and require exact match.
  - Validate id/kind prefix and metadata consistency.
  - Strict replay mode fails on first integrity mismatch.
- Code:
  - `readEvidenceArtifactById(...)`
  - `buildBundleDraftArtifacts(...)`
  - `computePortableReplayFromEvidenceBundle(...)`
  - in `apps/landing-engine/src/lib/radiography/runlogUtils.ts`

## 3) Oversized payload / resource abuse

- Risk:
  - Very large bundles or artifacts causing memory/CPU pressure.
- Mitigations:
  - Hard caps (`EVIDENCE_BUNDLE_LIMITS`):
    - `maxArtifacts: 200`
    - `maxSingleArtifactBytes: 512000`
    - `maxTotalBytes: 5000000`
  - Enforced during bundle read/import/replay.
- Code:
  - `validateBundleCaps(...)` in `runlogUtils.ts`

## 4) Non-JSON artifact payloads

- Risk:
  - Invalid or malicious artifact content payloads.
- Mitigations:
  - Artifact endpoint parses JSON only.
  - Content must sanitize into an object, otherwise `artifact_not_json`.
- Code:
  - `sanitizeArtifactJsonContent(...)`
  - `readEvidenceArtifactById(...)`

## 5) Sensitive path/URL leaks

- Risk:
  - Returning absolute paths, local machine identifiers, or raw URLs.
- Mitigations:
  - Forbidden patterns blocked/redacted:
    - `/Users/`, `\\Users\\`, `.bax/runlogs/`, `http(s)://`
  - Forbidden keys stripped:
    - `path`, `seed_urls_raw`, `inputs.seed_urls.urls`
  - Runlog parsing rejects forbidden content.
  - List API returns metadata only (no filesystem path).
- Code:
  - `FORBIDDEN_RUNLOG_STRING_PATTERNS`
  - `stripForbiddenRunLogKeys(...)`
  - `hasForbiddenRunLogContent(...)`
  - `sanitizeRunLogForPersist(...)`
  - `parseStoredRunLog(...)`

## 6) Replay collision overwrite

- Risk:
  - Replay persist stub overriding an existing run.
- Mitigations:
  - Explicit existence check before write.
  - Returns `409 run_already_exists`.
- Code:
  - `apps/landing-engine/src/app/api/radiography/runlog/evidence/replay/route.ts`

## Test-backed Controls

Golden tests in `apps/landing-engine/tests/runlog/runlog.golden.test.ts` validate:

- deterministic runlog listing order
- redaction of forbidden keys/values
- prune safety boundaries
- integrity mismatch detection
- non-json artifact rejection
- bundle export/import invariants
- replay strict/non-strict behavior
- replay persist collision handling

## Residual Risks (Current)

- Replay run_id determinism depends on JSON serialization order of input object structure; semantically equivalent bundles with different key order may produce different replay ids.
- `/api/radiography/runlog/[run_id]` uses `200` for `not_found`/`invalid` payload states, which can be ambiguous for strict API clients.
- Import route maps `integrity_mismatch` to `409`, while replay strict returns `422`; behavior is valid but inconsistent.
- Replay in non-strict mode currently emits warning strings derived from failure codes; consumers should treat them as identifiers, not user-facing forensic detail.

## Recommended Follow-ups (No code changes in this PR)

- Normalize status code semantics across import/replay (`integrity_mismatch`).
- Consider canonical JSON normalization for replay run_id hashing.
- Add a small API response schema doc generator to keep docs synchronized with route contracts.
- Consider adding explicit `baseline_run_id` in replay response (currently unavailable).
