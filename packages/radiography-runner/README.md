# @bax/radiography-runner

Deterministic Stage 0.1 runner that validates input, produces an auditable
output, and returns a BuildSpec v0 composer preset. No external I/O.

## Exports
- `runRadiographyV0(input)`

## Notes
- Input is validated via `@bax/radiography-contract`.
- Output is validated against the same contract.
- No PII is emitted.
