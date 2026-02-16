# Radiography Docs (Current State)

This folder documents the current implementation of Radiography runlogs + evidence portability in `bax-os`.

## Documents

- `docs/radiography/evidence-portability.md`
  - Concepts, deterministic/integrity model, persistence layout, and data-flow diagrams.
- `docs/radiography/api.md`
  - Current API behavior for runlog + evidence + bundle import/replay endpoints.
- `docs/radiography/cli.md`
  - CLI usage for evidence index/artifact/bundle/import/replay scripts.
- `docs/radiography/security-model.md`
  - Threat model, implemented mitigations (with code references), and residual risks.
- `docs/radiography/runbook.md`
  - End-to-end smoke runbook and troubleshooting notes.

## Scope

These docs are implementation-derived from current code and tests. They intentionally describe behavior as it exists today, including current status-code mappings and response shapes.
