# Evidence Portability v0 (Current State)

This document describes the implemented Radiography portability model in `bax-os`.

## Core Concepts

- **RunLog**
  - Canonical per-run JSON persisted under `.bax/runlogs/<run_id>.json`.
  - Schema: `RadiographyRunLogV0Schema` in `packages/radiography-contract/src/v0.ts`.
- **Evidence Artifact**
  - JSON artifact file (kinds: `inputs_summary`, `gating`, `debug`) with immutable metadata:
    - `id`, `kind`, `sha256`, `bytes`, `created_at`
  - Code: `EvidenceArtifactV0` in `apps/landing-engine/src/lib/radiography/runlogUtils.ts`.
- **Evidence Index**
  - `index.json` under `.bax/evidence/<run_id>/` listing artifact metadata.
- **Evidence Bundle**
  - Portable JSON package combining:
    - bundle header (`bundle_version`, `run_id`, `created_at`)
    - `evidence_index`
    - `artifacts[]` with embedded JSON `content`
  - Used by export/import/replay endpoints.
- **Imported Stub RunLog**
  - Minimal runlog created during bundle import (`source: "imported_bundle"`, `is_stub: true`).
- **Portable Replay Stub RunLog**
  - Optional runlog created during bundle replay with `persist_stub=true`
  - Marked `source: "portable_replay"`, `is_stub: true`.

## Determinism + Integrity Model

## Determinism

- Replay computation is local and pure over bundle JSON.
- `strict=true` (default): replay fails on integrity mismatch.
- `strict=false`: replay degrades deterministically to fallback gating:
  - `status: soft_fail`
  - `core_percent: 50`
  - `reason_codes: ["needs_manual_verify"]`
- Replay run_id (when not explicitly provided) is deterministic:
  - `replay-<normalized_bundle_run_id>-<sha256(bundle_pretty_json_prefix)>`

## Integrity checks

- Each artifact is validated for:
  - id format + kind prefix
  - metadata match (`id/kind/sha256/bytes/created_at`)
  - content re-serialization hash + byte length exact match
- Bundle guardrails:
  - max artifacts: 200
  - max artifact bytes: 512,000
  - max total bytes: 5,000,000

## Strict vs non-strict replay

- `strict=true`
  - Integrity mismatch => `422` / `error: "integrity_mismatch"`
- `strict=false`
  - Returns `ok:true`
  - `compare.match=false`
  - `compare.diff.integrity_warnings[]` populated

## Data Flow Diagrams

## 1) Export -> Import -> Stub

```text
RunLog (.bax/runlogs/<id>.json)
  -> writeEvidencePackForRunLog(...)
  -> Evidence Dir (.bax/evidence/<id>/index.json + artifacts)
  -> GET /api/radiography/runlog/evidence/[run_id]/bundle
  -> bundle.json
  -> POST /api/radiography/runlog/evidence/import
  -> writes imported evidence pack + imported stub runlog
```

## 2) Bundle -> Replay -> Compare

```text
bundle.json
  -> POST /api/radiography/runlog/evidence/replay
  -> computePortableReplayFromEvidenceBundle(...)
       - derive baseline gating from gating artifact (or fallback)
       - verify artifact integrity
       - produce replay gating + decision_trace + compare diff
  -> returns replay + compare (+ optional persisted)
```

## 3) Replay -> Persist Stub

```text
POST /evidence/replay { options: { persist_stub: true, ... } }
  -> compute replay result
  -> collision check (existing run_id)
  -> writeRunLog(runlog_stub)
       - stores .bax/runlogs/<run_id>.json
       - regenerates evidence pack under .bax/evidence/<run_id>/
  -> response includes persisted { run_id, is_stub, source }
```

## What is persisted and where

- Runlogs:
  - `.bax/runlogs/<run_id>.json`
  - via `writeRunLog(...)` (`apps/landing-engine/src/lib/radiography/runlogStorage.ts`)
- Evidence:
  - `.bax/evidence/<run_id>/index.json`
  - `.bax/evidence/<run_id>/<artifact_id>.json`
  - via `writeEvidencePackForRunLog(...)` and import logic in `runlogUtils.ts`

## Anti-leak rules (implemented)

- Forbidden string patterns are blocked/redacted:
  - `/Users/`, `\\Users\\`, `.bax/runlogs/`, `http(s)://`
- Forbidden keys removed from payloads:
  - `path`, `seed_urls_raw`, legacy `inputs.seed_urls.urls`
- Raw URLs are never persisted in runlogs/evidence:
  - only `seed_urls.count`, `seed_urls.unique_hosts`, `seed_urls.url_hashes`

## Source-of-truth code paths

- Model + portability logic:
  - `apps/landing-engine/src/lib/radiography/runlogUtils.ts`
- Runlog file storage/list/prune:
  - `apps/landing-engine/src/lib/radiography/runlogStorage.ts`
- Contract schemas:
  - `packages/radiography-contract/src/v0.ts`
- Behavioral invariants:
  - `apps/landing-engine/tests/runlog/runlog.golden.test.ts`
