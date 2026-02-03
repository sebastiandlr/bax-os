# BAX — Event Schema v0 (D3)

> **D3 = Candado anti‑drift:** este documento define **qué medimos**, **cómo lo medimos** y **qué NUNCA registramos**.  
> Todo lo que sea “analytics”, “insights” o “optimization” debe alinearse a este esquema.  
> Si un evento no está aquí, **no existe** (o debe proponerse vía Decision Log D2).

---

## 0) Objetivo

Construir una capa de eventos:

- **Horizontal** (sirve para cualquier negocio/vertical).
- **Privacidad‑first** (sin PII en analytics).
- **Debuggable** (cada evento tiene trace, versión, source, y un payload acotado).
- **Composable** (capabilities activan eventos, no código ad‑hoc por cliente).
- **Accionable** (cada evento existe porque habilita una decisión de negocio o un funnel).

---

## 1) Principios no negociables

### P1 — No PII en eventos
**PROHIBIDO** incluir:
- nombre, teléfono, email
- mensajes libres (chat transcripts, notes, “message”)
- direcciones exactas
- IDs externos sensibles (Stripe customer id, WhatsApp phone, etc.)

**Permitido**:
- IDs internos **pseudónimos** (`lead_id`, `session_id`, `anon_user_id`)
- buckets / rangos (ej. `party_size_bucket: "1-2"`, `budget_bucket: "50k-100k"`)
- hashes irreversibles solo si es estrictamente necesario para dedupe (ver sección 8)

### P2 — Evento = verbo + objeto + contexto
- Debe mapear a un **estado** del funnel o una **acción** del usuario/sistema.
- Debe existir una razón de negocio: “¿Qué decisión habilita?”

### P3 — Versión explícita
El esquema del evento se versiona con:
- `schema_version: "0.1.0"` (este doc)
- `event_version: "1"` (por evento; cambia cuando el payload cambia)

### P4 — Determinismo y estabilidad
Los nombres de eventos y propiedades deben ser estables para:
- dashboards,
- cohortes,
- A/B tests,
- comparativas entre clientes.

### P5 — Portable across stacks
El esquema no depende de GA4, PostHog o Segment.  
Se puede traducir a cualquiera sin perder meaning.

---

## 2) Taxonomía (Namespaces)

Eventos se agrupan por namespace:

- `marketing.*` — landing/website (static o theatre)
- `intake.*` — intake, spec, validation, approvals
- `composer.*` — composición de UI, reglas, buildspec, preview
- `deploy.*` — deploy safe, domain, env, status
- `agent.*` — agentes (sales/support/outbound) — **sin contenido**
- `crm.*` — lead lifecycle (stage changes, routing)
- `payments.*` — intent de pago (sin IDs de pago sensibles)
- `ops.*` — operaciones internas (SLA, handoffs, QA)
- `errors.*` — errores controlados (no stack traces con secrets)

**Regla:** Si dudas dónde va, va en `ops.*` o se propone en D2.

---

## 3) Naming Convention

Formato:

```
<namespace>.<verb>_<object>
```

Ejemplos:
- `marketing.view_hero`
- `marketing.click_cta_primary`
- `intake.submit_form`
- `composer.generate_preview`
- `deploy.complete_site`
- `agent.escalate_human`
- `errors.webgl_unavailable`

**Verbos recomendados**
`view`, `click`, `submit`, `start`, `complete`, `fail`, `select`, `open`, `close`, `generate`, `approve`, `reject`, `escalate`, `route`, `export`

---

## 4) Envelope (campos base obligatorios)

Todo evento debe seguir este “sobre”:

```json
{
  "event_name": "marketing.click_cta_primary",
  "event_version": "1",
  "schema_version": "0.1.0",
  "occurred_at": "2026-02-03T22:41:12.123Z",
  "source": {
    "surface": "landing_static | landing_theatre | studio | agent | ops",
    "runtime": "web",
    "env": "dev | prod",
    "build_id": "git_sha_or_vercel_build",
    "client_id": "bax_internal_client_id",
    "site_id": "bax_internal_site_id"
  },
  "actor": {
    "anon_user_id": "uuid",
    "session_id": "uuid",
    "role": "visitor | lead | client_admin | bax_ops"
  },
  "context": {
    "page_path": "/",
    "referrer_domain": "google.com",
    "utm": {
      "source": "google",
      "medium": "cpc",
      "campaign": "bax_launch"
    },
    "device": {
      "type": "mobile | desktop",
      "os": "ios | android | mac | windows | linux",
      "browser": "safari | chrome | firefox | edge"
    },
    "locale": "es-MX"
  },
  "payload": {}
}
```

### Required vs Optional (v0)
**Obligatorios**:
- `event_name`, `event_version`, `schema_version`, `occurred_at`
- `source.surface`, `source.env`, `source.client_id`, `source.site_id`
- `actor.anon_user_id`, `actor.session_id`
- `context.page_path`

**Opcionales** (pero recomendados):
- `source.build_id`
- `context.utm`, `context.device`, `context.locale`

---

## 5) IDs y Reglas de Identidad

### anon_user_id
- Generado en cliente (cookie/localStorage) con UUID.
- Rotación: 90 días o cuando user limpia storage.

### session_id
- Generado por sesión (30 min inactivity resets).
- Sirve para funnels y debugging.

### lead_id (cuando aplique)
- Solo aparece después de un submit que crea un lead.
- Debe ser **interno** y pseudónimo.

### client_id / site_id
- Siempre internos (BAX).
- No usar nombres reales del negocio en eventos.

---

## 6) Core Events v0 (MVP)

> Este set es el mínimo para operar Landing Express y aprender.

### 6.1 marketing.*
**marketing.page_view**
Payload:
```json
{ "mode": "static | theatre", "page_kind": "home | pricing | intake" }
```

**marketing.view_hero**
Payload:
```json
{ "mode": "static | theatre", "hero_variant": "A | B | C" }
```

**marketing.scroll_depth**
Payload:
```json
{ "mode": "static | theatre", "depth_pct": 25 }
```

**marketing.click_cta_primary**
Payload:
```json
{ "mode": "static | theatre", "cta_id": "primary", "cta_label": "Start" }
```

**marketing.open_intent_drawer**
Payload:
```json
{ "mode": "static | theatre", "entry_point": "hero | nav | section_pricing" }
```

### 6.2 intake.*
**intake.start**
Payload:
```json
{ "mode": "express", "entry_point": "hero_cta" }
```

**intake.submit_form**
Payload (NO PII):
```json
{
  "mode": "express",
  "business_type": "services | restaurant | venue | other",
  "transaction_model": "lead | booking | quote",
  "timeline": "24h | 48h | 72h",
  "assets_ready": true
}
```

**intake.validation_fail**
Payload:
```json
{ "mode": "express", "field": "logo", "reason": "missing_required_asset" }
```

**intake.complete**
Payload:
```json
{ "mode": "express", "lead_id": "uuid", "handoff": "auto | ops" }
```

### 6.3 composer.*
**composer.spec_generated**
Payload:
```json
{ "spec_version": "1", "confidence": 0.86, "source_inputs": ["url", "logo"] }
```

**composer.preview_generated**
Payload:
```json
{ "preview_kind": "ghost | paid", "render_ms": 842, "sections_count": 9 }
```

**composer.section_variant_selected**
Payload:
```json
{ "section_id": "pricing", "variant_id": "pricing.v2", "reason": "mode=quote" }
```

### 6.4 deploy.*
**deploy.start**
Payload:
```json
{ "deploy_target": "vercel", "kind": "landing" }
```

**deploy.complete**
Payload:
```json
{ "deploy_target": "vercel", "kind": "landing", "duration_s": 71 }
```

**deploy.fail**
Payload:
```json
{ "deploy_target": "vercel", "kind": "landing", "error_code": "build_failed" }
```

### 6.5 ops.*
**ops.qa_pass**
Payload:
```json
{ "qa_profile": "mobile | desktop | reduced_motion", "notes_code": "ok" }
```

**ops.client_revision_requested**
Payload:
```json
{ "round": 1, "category": "copy | images | layout", "scope": "minor | major" }
```

### 6.6 errors.*
**errors.webgl_unavailable**
Payload:
```json
{ "mode": "theatre", "fallback": "static" }
```

**errors.runtime_exception**
Payload (sin stack trace completo):
```json
{ "where": "marketing_stage", "error_code": "unexpected" }
```

---

## 7) Funnels canónicos (MVP)

### Funnel F0 — Landing → Intake
1. `marketing.page_view`
2. `marketing.view_hero`
3. `marketing.click_cta_primary`
4. `intake.start`
5. `intake.submit_form`
6. `intake.complete`

**KPI**
- Hero CVR = `click_cta_primary / view_hero`
- Intake CVR = `intake.complete / intake.start`
- Form Dropoff = `intake.validation_fail / intake.submit_form_attempts` (si se instrumenta)

### Funnel F1 — Theatre Safety
1. `marketing.page_view` (mode=theatre)
2. `errors.webgl_unavailable` (si ocurre)
3. `marketing.page_view` (mode=static) o `marketing.view_hero` (static)

**KPI**
- Fallback rate = `errors.webgl_unavailable / marketing.page_view(theatre)`

---

## 8) Privacidad, Retención, Redacción

### Retención (recomendada v0)
- Eventos de analytics: 90 días
- Eventos de ops: 180 días (si no contienen PII)
- Errores agregados: 30 días (o según volumen)

### Redacción (PII guardrails)
- Bloquear keys prohibidas en payload: `name`, `email`, `phone`, `message`, `address`, `notes`
- Si aparece, el SDK debe:
  1) eliminar el campo,
  2) emitir `errors.analytics_pii_blocked`,
  3) continuar sin romper el flujo.

### Hashing (solo si se necesita)
Si en el futuro se requiere dedupe:
- Solo hashing irreversible (SHA-256) + salt rotatorio
- Solo para campos permitidos por compliance
- Debe documentarse en D2

---

## 9) Instrumentation Guidelines (Next.js)

### Client-side (marketing/intake)
- Emitir eventos en interacción (click/submit/scroll) con throttle.
- No bloquear UI (fire-and-forget).
- Mantener payloads pequeños (< 2KB).

### Server-side (deploy/ops)
- Emitir eventos de estado: `deploy.complete`, `ops.qa_pass`.
- Nunca incluir logs con secrets.

### Reduced motion
- Eventos deben incluir `context.prefers_reduced_motion: true/false` si se puede.
- El modo “theatre” debe degradar a “static” sin pérdida de funnel.

---

## 10) Data Dictionary (Propiedades estándar)

| Field | Type | Notes |
|------|------|------|
| `mode` | string | `static` o `theatre`, o `express` para intake |
| `transaction_model` | string | `lead | booking | quote` |
| `business_type` | string | `services | restaurant | venue | other` |
| `hero_variant` | string | `A|B|C` (A/B tests) |
| `section_id` | string | id estable |
| `variant_id` | string | id estable |
| `confidence` | number | 0–1 |
| `duration_s` | number | segundos |
| `render_ms` | number | milisegundos |

---

## 11) Governance (cómo se cambia este documento)

- Cambios al envelope, principios o PII rules → **Decision Log (D2)** + bump `schema_version`.
- Agregar un evento nuevo:
  1) Proponer en D2: objetivo + KPI
  2) Definir payload mínimo
  3) Implementar + test
  4) Documentar aquí con `event_version`

---

## 12) Appendix — Event Proposals (Backlog)

> Ideas permitidas pero **NO** parte del MVP sin D2:
- `marketing.ab_test_assigned`
- `agent.handoff_summary_generated` (sin contenido)
- `crm.stage_changed`
- `payments.intent_created` (sin ids externos)
- `insights.health_score_updated`

---
