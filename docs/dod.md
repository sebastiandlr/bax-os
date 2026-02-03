# BAX — Definition of Done (DoD) + Stop Rules (D1)

> **Purpose:** This document is the global “completion contract” for BAX.  
> If a task does not meet this DoD, it is **not done**—even if it “looks finished.”

---

## 0) Scope

This DoD applies to:
- **BAX Landing** (marketing surface, conversion flows, demo modes)
- **BAX Studio** (builder surface, spec generation, preview)
- **BAX Core Runtime** (schemas, composer, engines, shared utilities)
- **Ops tooling** (client generation, deployment workflows, instrumentation)

Unless a ticket explicitly states otherwise, **all items below are required**.

---

## 1) Non‑Negotiables (Global Guardrails)

### 1.1 Build integrity
- `npm run lint` ✅
- `npm run build` ✅  
- No TypeScript errors/warnings that affect runtime stability
- No “works on my machine” dependency on local state (ports, lockfiles, caches)

### 1.2 No scope drift
- Work is limited to the ticket scope.
- Any new idea → goes into backlog, **not** the current PR.

### 1.3 No hidden coupling
- No “spooky action at a distance” changes in unrelated modules.
- If a change affects other modules, it must be explicitly stated in:
  - PR description / changelog section
  - Decision Log entry (see D2)

### 1.4 Consent-first data posture
- No scraping or ingestion without clear **consent or explicit business authorization** in MVP paths.
- No storing PII unless required and declared in the schema.

### 1.5 Reduced-motion safe
- `prefers-reduced-motion: reduce` produces a stable, premium experience.
- No heavy scrub/scroll-jacking in reduced-motion mode.

---

## 2) “Stop Rules” (When Work Must Halt Immediately)

If any of the following occurs, **STOP** and fix before proceeding:

1. **Build is red** (`lint` or `build` fails).
2. A change breaks the primary flow:
   - Landing: CTA click → intake start → submit
   - Studio: intake → spec generate → preview render
3. An unreviewed change introduces:
   - new dependency requiring install/network
   - new data storage surfaces for PII
   - changes to protected areas (e.g., `/studio` when forbidden by ticket constraints)
4. UX regressions:
   - “blank/black slab” above-the-fold
   - CTA not visible/clickable at first paint
   - overlays blocking interaction unintentionally
5. Performance regressions:
   - obvious jank
   - noticeable CLS on first load
6. Any uncertainty about correctness:
   - ambiguous interpretation of contract/spec
   - unclear schema fields or semantics

---

## 3) DoD Checklist (Required for “Done”)

### 3.1 Functional completeness
- Feature matches ticket acceptance criteria **exactly**.
- No dead states: at T=0 the user sees:
  - clear hero copy
  - at least one primary CTA
  - a visible, intentional layout (no “broken panel” perception)
- All user-facing flows are testable end-to-end manually.

### 3.2 UX / UI quality (Frontier baseline)
- **Hierarchy** is clear:
  - headline → subheadline → proof → CTA
- **Affordances** are clear:
  - CTAs look clickable and are not blocked by overlays
- **Consistency**:
  - typography scale consistent
  - spacing system consistent
  - color tokens consistent
- **Responsive**:
  - works on mobile, tablet, desktop
  - no overflow, no clipped content, no inaccessible controls

### 3.3 Accessibility
Minimum baseline:
- Semantic landmarks (header/main/footer) where relevant
- Buttons/inputs are keyboard reachable
- Focus visible
- Contrast is acceptable for primary text/CTA
- Motion respects reduced-motion preference

### 3.4 Performance & stability
- No obvious runtime errors in console
- Avoid unnecessary re-renders / heavy loops
- No uncontrolled timers/intervals without cleanup
- No infinite loops in effects
- Avoid hydration mismatch warnings
- CLS minimized by:
  - fixed containers / explicit heights
  - avoiding layout jumps on hydration

### 3.5 Event instrumentation (MVP baseline)
For any conversion-relevant change:
- Events must be emitted according to **Event Schema v0** (D3):
  - `page_view`
  - `cta_click`
  - `lead_submit` / `booking_start` / `quote_submit` (depending on mode)
- Events include:
  - `mode` (lead/booking/quote)
  - `source` (landing/studio)
  - minimal context (no sensitive payloads)

### 3.6 Schema / Contract compliance (Core)
If the ticket touches BusinessDNA/Composer:
- Schema validates (Zod or equivalent)
- Backward compatibility rules documented:
  - versioning strategy
  - migration notes if needed
- No ambiguous fields
- Defaults are explicit

### 3.7 Documentation update (minimum)
At least one of:
- Update the relevant `/docs/*` file (1–10 lines minimum)
- Add an entry to Decision Log when semantics changed
- Add or update a README section for new scripts/flows

---

## 4) Required Proof Artifacts (Attach to PR / Commit Notes)

A change is not “done” unless you can provide:

### 4.1 Command outputs (verbatim)
- `npm run lint`
- `npm run build`
- `git status -sb`
- `git diff --stat` (or PR file list)

### 4.2 Visual proof (where UI changes)
- Screenshot(s) or short screen recording:
  - Desktop hero above-the-fold
  - Mobile hero above-the-fold
  - Reduced-motion mode (at least 1 view)

### 4.3 Smoke test notes (bullet list)
- What was tested
- What was not tested (and why)

---

## 5) Definitions (So We Don’t Argue Later)

### 5.1 “Green”
- `lint` ✅ and `build` ✅, **in the same state** as the commit/branch being shipped.

### 5.2 “No regression”
- The primary conversion flow does not get worse:
  - no new empty states
  - no worse CTA visibility/clickability
  - no new console errors

### 5.3 “Scope drift”
- Any feature not required for the ticket’s acceptance criteria.

### 5.4 “Premium”
- Above-the-fold looks intentional.
- Clear hierarchy and contrast.
- No “broken/unfinished” perception.

---

## 6) Quality Gates by Surface

### 6.1 Landing (Marketing)
Must satisfy:
- T=0 hero visible (copy + CTA)
- No “dead slab” panels
- Fast first interaction
- SEO-safe fallback exists (at least minimal content)

### 6.2 Studio
Must satisfy:
- Intake → Spec → Preview flow works
- No writes to seed/intake unless explicitly allowed
- Deterministic behavior: same input → same spec (within defined randomness policy)

### 6.3 Factory / Deployment (later phases)
Must satisfy:
- Idempotent deploy scripts (safe reruns)
- Secrets never logged
- Rollback plan exists

---

## 7) Acceptance Criteria Template (Use in Tickets)

Each ticket must include:
- **Objective:** what changes for the user
- **In-scope:** exact files/surfaces
- **Out-of-scope:** explicit exclusions
- **DoD additions:** any extra checks beyond this document
- **Acceptance criteria:** 3–7 bullets
- **Proof required:** screenshots, logs, event proof

---

## 8) “Ready” Definition (Before Starting a Ticket)

A ticket is “Ready” only if:
- Inputs are known (copy, mode, schema fields)
- Constraints are known (no deps / no studio / etc.)
- Success metrics are known (what to measure)
- There is a rollback or safe fallback if it fails

---

## 9) Release Checklist (Minimum)

Before pushing a “release-worthy” change:
- `lint` ✅
- `build` ✅
- Smoke test run
- Events verified (at least one conversion event)
- Docs updated minimally
- Decision Log updated if semantics changed

---

## 10) Authority Clause

If there’s a conflict between:
- a ticket instruction,
- an architecture contract,
- and this DoD,

…the **stricter constraint wins** unless the CTO explicitly overrides it in writing.
