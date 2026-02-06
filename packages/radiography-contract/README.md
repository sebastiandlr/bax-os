# @bax/radiography-contract

Stage 0.1 “Radiography Rails” contract for deterministic, auditable runs.
Defines strict input/output schemas and versioned enums for provenance,
status, and gap reporting. No PII is permitted in outputs or logs.

## Scope
- Strict versioned contract: `0.1.0`
- Input: seed URLs + business identity + mode hint
- Output: auditable artifacts (patches, provenance, gap report, composer preset)

## Exports
- `RadiographyInputV0Schema`, `RadiographyOutputV0Schema`
- `SourceTypeEnum`, `FieldStatusEnum`, `ReasonCodeEnum`
- `CORE_FIELDS_V0`, `JsonPatchV0Schema`

## Notes
- `composer_preset` is validated against BuildSpec v0.
- `business_dna_partial` is intentionally permissive for Stage 0.
