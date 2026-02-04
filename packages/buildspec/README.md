# @bax/buildspec

BuildSpec is the contract that describes what a landing build must render.
It is intentionally small, versioned, and strict so the Composer and runtime
can stay deterministic while scaling output volume.

## Example
```json
{
  "schemaVersion": "0.1.0",
  "mode": "lead",
  "capabilities": [
    "hero_identity_block",
    "offer_showcase",
    "trust_proof",
    "lead_capture",
    "faq_support",
    "analytics_core"
  ],
  "eventSchemaVersion": "0.1.0",
  "metadata": { "clientId": "bax_client_001", "siteId": "site_001" }
}
```

## Validate
```ts
import { parseBuildSpecV0 } from "@bax/buildspec";

const spec = parseBuildSpecV0(input);
```

## Design constraints
- Strict schema: unknown keys are rejected.
- Versioned contract: `schemaVersion` and `eventSchemaVersion` are required.
- Capabilities are unique and capped at 9.
- Mode is a single primary objective (`lead`, `booking`, `quote`).
