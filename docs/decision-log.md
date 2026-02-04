# BAX — Decision Log (D2)

> **Purpose:** Prevent drift. This is the single source of truth for **why** we made structural decisions.  
> If a debate repeats, the answer should live here.

**Rules**
- Every decision gets an ID: `DL-YYYY-MM-DD-###`
- Keep entries **small and atomic**.
- Each entry must include:
  - **Context**
  - **Decision**
  - **Rationale**
  - **Alternatives considered**
  - **Consequences / risks**
  - **Rollback plan**
  - **Owner**
  - **Status**: `proposed | accepted | deprecated`
- If a decision changes a schema/contract: add a **Migration note** and bump version.
- If a decision impacts runtime behavior: add a **DoD note** (D1) and ensure `lint/build` green.

---

## Index

- [DL-2026-02-04-001 — Introduce BuildSpec v0 contract (@bax/buildspec)](#dl-2026-02-04-001--introduce-buildspec-v0-contract-baxbuildspec)
- [DL-2026-02-03-001 — Vertical slice MVP: Landing Express first](#dl-2026-02-03-001--vertical-slice-mvp-landing-express-first)
- [DL-2026-02-03-002 — Target initial wedges: services, restaurants, banquet venues](#dl-2026-02-03-002--target-initial-wedges-services-restaurants-banquet-venues)
- [DL-2026-02-03-003 — Business atoms abstraction (Offer/Transaction/Identity/Operation)](#dl-2026-02-03-003--business-atoms-abstraction-offertransactionidentityoperation)
- [DL-2026-02-03-004 — Two-mode marketing runtime: static vs theatre](#dl-2026-02-03-004--two-mode-marketing-runtime-static-vs-theatre)
- [DL-2026-02-03-005 — No installs / no new deps in marketing stabilizations](#dl-2026-02-03-005--no-installs--no-new-deps-in-marketing-stabilizations)
- [DL-2026-02-03-006 — Consent-first ingestion posture](#dl-2026-02-03-006--consent-first-ingestion-posture)
- [DL-2026-02-03-007 — Hybrid repo model for scale: core + per-client repos](#dl-2026-02-03-007--hybrid-repo-model-for-scale-core--per-client-repos)
- [DL-2026-02-03-008 — Schema-first development: BusinessDNA v1 as contract](#dl-2026-02-03-008--schema-first-development-businessdna-v1-as-contract)
- [DL-2026-02-03-009 — Composer v1: atomic sections + deterministic rules](#dl-2026-02-03-009--composer-v1-atomic-sections--deterministic-rules)
- [DL-2026-02-03-010 — Event schema baseline and “no PII in events”](#dl-2026-02-03-010--event-schema-baseline-and-no-pii-in-events)
- [DL-2026-02-03-011 — Production cadence: 10 landings/week with ops checklist](#dl-2026-02-03-011--production-cadence-10-landingsweek-with-ops-checklist)
- [DL-2026-02-03-012 — Reduced-motion as first-class requirement](#dl-2026-02-03-012--reduced-motion-as-first-class-requirement)

---

## DL-2026-02-04-001 — Introduce BuildSpec v0 contract (@bax/buildspec)
**Status:** accepted  
**Owner:** CTO  
**Date:** 2026-02-04

### Decision
Adopt BuildSpec v0 as a required contract and add `@bax/buildspec` with Zod validation.

### Rationale
We need a strict, versioned interface between intake/composer and the runtime to keep output deterministic and auditable.

### Consequences / risks
- Build/compose inputs must validate against BuildSpec v0.
- Any changes require a Decision Log update and version bump to avoid drift.

## DL-2026-02-03-001 — Vertical slice MVP: Landing Express first
**Status:** accepted  
**Owner:** CTO

### Context
We need revenue fast and a learning loop grounded in real customer signal, not speculative feature building.

### Decision
Ship **Landing Express** as the first revenue product. The MVP must deliver a premium landing/website with a lightweight intake → build → publish workflow. Higher-order features (agents, CRM, analytics moat) are **post-MVP modules**.

### Rationale
- Fast cashflow funds iteration.
- Produces the **signal** required to validate which deeper modules matter.
- Keeps complexity controlled while building the Runtime foundation.

### Alternatives considered
1) Build agents + omnichannel + CRM first  
2) Build full “factory auto-deploy” first

### Consequences / risks
- Risk: underwhelming “AI wow” initially. Mitigation: high-quality demo + theatre mode.
- Risk: platform narrative mismatch. Mitigation: manifesto + capability map and clear roadmap.

### Rollback plan
If Landing Express fails to convert, pivot to a more explicit “done-for-you” agency package while keeping the same internal runtime.

---

## DL-2026-02-03-002 — Target initial wedges: services, restaurants, banquet venues
**Status:** accepted  
**Owner:** CTO

### Context
We need a focus wedge that maximizes conversion and repeatability without narrowing the long-term horizontal thesis.

### Decision
Operate with three initial wedges:
- **Servicios profesionales** (dentista/abogado/médico/constructor)
- **Restaurantes**
- **Salones de eventos / banquetes**

### Rationale
- High frequency needs: leads, booking, quote.
- Strong “proof artifacts”: menus, galleries, testimonials, availability.
- High upside for upsells (ads/automation/call handling).

### Alternatives considered
- E-commerce-first
- SaaS-only “self-serve builder”

### Consequences / risks
- Risk: overfitting templates. Mitigation: Business atoms + capability map remain horizontal.
- Risk: operational variance. Mitigation: Mode-based intake + Composer rules.

### Rollback plan
If one wedge drags ops, deprioritize it; keep the atoms and runtime unchanged.

---

## DL-2026-02-03-003 — Business atoms abstraction (Offer/Transaction/Identity/Operation)
**Status:** accepted  
**Owner:** CTO

### Context
We need a stable mental model and contract that generalizes across verticals.

### Decision
Model every business as four atoms:
- **Offer** (what they sell)
- **Transaction** (how money/leads happen)
- **Identity** (brand/voice)
- **Operation** (how they serve/support)

### Rationale
This makes the product horizontal while allowing vertical presets.

### Alternatives considered
- Sector-specific schema trees only

### Consequences / risks
- Risk: too abstract → weak UX. Mitigation: wedge presets + mode-specific intake.
- Risk: missing “legal/compliance” in some verticals. Mitigation: capabilities include compliance module later.

### Rollback plan
Add a fifth atom if reality forces it, but preserve backward compatibility via versioning.

---

## DL-2026-02-03-004 — Two-mode marketing runtime: static vs theatre
**Status:** accepted  
**Owner:** CTO

### Context
A 3D/scroll theatre can look premium but can also break perception and conversion if it fails or feels empty.

### Decision
Introduce a **safety switch**:
- `NEXT_PUBLIC_MARKETING_MODE=static` (default): conventional, conversion-first landing
- `NEXT_PUBLIC_MARKETING_MODE=theatre`: premium demo experience

### Rationale
- Ensures conversion reliability while keeping “wow” available.
- Allows A/B testing and progressive enhancement.

### Alternatives considered
- Theatre-only
- Static-only

### Consequences / risks
- Risk: maintaining two experiences. Mitigation: shared copy + shared section structure.
- Risk: inconsistency. Mitigation: Composer rules define both modes’ content contract.

### Rollback plan
If theatre underperforms or increases support cost, keep static only and retire theatre.

---

## DL-2026-02-03-005 — No installs / no new deps in marketing stabilizations
**Status:** accepted  
**Owner:** CTO

### Context
Dependency churn destabilized builds and slowed iteration.

### Decision
Marketing stabilization work must avoid new deps unless explicitly approved in an RFC and tested green in CI.

### Rationale
- Faster iteration
- Lower risk of breakage
- Less operational entropy

### Alternatives considered
- Add postprocessing libs / heavy motion libs ad hoc

### Consequences / risks
- Risk: less visual sophistication. Mitigation: CSS shaders/gradients, restrained 3D.

### Rollback plan
Allow deps when we have CI + lockfile discipline + version pinning.

---

## DL-2026-02-03-006 — Consent-first ingestion posture
**Status:** accepted  
**Owner:** CTO

### Context
We discussed “Harvester” style ingestion; that carries risk and reputational downside if done without consent.

### Decision
MVP ingestion is **consent-first**:
- Client provides URL/assets/OAuth
- No scraping personal profiles
- Any enrichment is via official APIs or user-provided data

### Rationale
- Long-term durability
- Avoid TOS violations
- Builds trust

### Alternatives considered
- Aggressive outbound scraping with “ghost spec” unsolicited

### Consequences / risks
- Risk: slower top-of-funnel. Mitigation: use human-led prospecting + demos; later add ethical signal gathering.

### Rollback plan
If later we add “ghost preview”, it must be **opt-in** and show only publicly available business info, with compliance review.

---

## DL-2026-02-03-007 — Hybrid repo model for scale: core + per-client repos
**Status:** accepted  
**Owner:** CTO

### Context
We need to deliver 10+ landings/week without turning into a repo graveyard or unmaintainable monolith.

### Decision
Use a **hybrid repo model**:
- One **core** repo for templates/runtime/contracts
- Per-client repos generated from the core (thin “skin” layer) when needed
- Optional multi-tenant for enterprise groups later

### Rationale
- Enables client ownership and clean deployments
- Enables updates via controlled patching
- Keeps internal runtime centralized

### Alternatives considered
- Monorepo for everything
- One repo per client with no shared core

### Consequences / risks
- Risk: sync complexity. Mitigation: generator + version stamps + patch strategy.
- Risk: support overhead. Mitigation: tiered support and standard update windows.

### Rollback plan
Start with a single multi-tenant “clients workspace” repo for early days, then split when volume demands it.

---

## DL-2026-02-03-008 — Schema-first development: BusinessDNA v1 as contract
**Status:** accepted  
**Owner:** CTO

### Context
Without contracts, feature building becomes inconsistent and hard to debug.

### Decision
BusinessDNA v1 is the **canonical contract** for business configuration. Any capability must be representable as a schema extension, not bespoke code paths.

### Rationale
- Debuggable diffs
- Repeatable assembly
- Clean separation between input and output

### Alternatives considered
- Ad-hoc props and per-page custom logic

### Consequences / risks
- Risk: initial schema design cost. Mitigation: keep v1 minimal and versioned.

### Rollback plan
If a capability cannot fit, create a “capability-specific extension” namespace rather than breaking the schema.

---

## DL-2026-02-03-009 — Composer v1: atomic sections + deterministic rules
**Status:** accepted  
**Owner:** CTO

### Context
We need consistency and speed: the landing must be assembled from known good primitives.

### Decision
Use Composer v1 as a rules engine:
- Section order is deterministic by `mode` and `capabilities`
- Copy skeletons are standardized
- Only limited degrees of freedom per wedge

### Rationale
- Lets us scale output quality
- Reduces QA time
- Prevents “art project” drift

### Alternatives considered
- Free-form AI composition

### Consequences / risks
- Risk: less uniqueness. Mitigation: controlled brand style layer and media gallery.

### Rollback plan
Add “custom overrides” only as explicit, tracked diffs.

---

## DL-2026-02-03-010 — Event schema baseline and “no PII in events”
**Status:** accepted  
**Owner:** CTO

### Context
We need measurement and learning without creating a privacy liability.

### Decision
Adopt Event Schema v0 with hard rule:
- **No PII in analytics events** (names, phones, emails, free-form message bodies)

### Rationale
- Lower compliance burden
- Safer iteration
- Still supports conversion tracking

### Alternatives considered
- Logging full conversations into analytics

### Consequences / risks
- Risk: less granular insight. Mitigation: store sensitive content only in secure, consented systems when needed.

### Rollback plan
If later we need richer insights, add a secure “conversation store” separate from analytics with explicit retention policy.

---

## DL-2026-02-03-011 — Production cadence: 10 landings/week with ops checklist
**Status:** accepted  
**Owner:** Ops Lead (future), CTO interim

### Context
We want cashflow with minimal founder involvement and the ability to hire operators.

### Decision
Operate via a standardized checklist (Landing Express ops doc) with:
- Strict intake requirements
- Limited revision rounds
- Asset requirements and deadlines

### Rationale
- Predictable throughput
- Easier delegation
- Keeps quality high

### Alternatives considered
- Unlimited revisions / bespoke builds

### Consequences / risks
- Risk: some clients want bespoke. Mitigation: upsell to custom tier.

### Rollback plan
Create a “custom build” lane with separate pricing and timeline.

---

## DL-2026-02-03-012 — Reduced-motion as first-class requirement
**Status:** accepted  
**Owner:** CTO

### Context
Theatre-style interactions can break accessibility and create motion sickness.

### Decision
All motion features must provide a reduced-motion alternative that remains premium and information-complete.

### Rationale
- Accessibility
- Lower bounce risk
- More stable engineering

### Alternatives considered
- Ignore reduced-motion or degrade it heavily

### Consequences / risks
- Slight extra engineering. Worth it.

### Rollback plan
N/A (non-negotiable).

---

## Template (copy/paste for new decisions)

### DL-YYYY-MM-DD-### — Title
**Status:** proposed  
**Owner:**

#### Context
#### Decision
#### Rationale
#### Alternatives considered
#### Consequences / risks
#### Rollback plan
#### Migration note (if schema/contract changes)
