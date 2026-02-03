# /docs/capability-map-v0.md
> **BAX — Capability Map v0 (MVP Runtime)**
>
> **Version:** v0.1  
> **Owner:** BAX Product/CTO  
> **Status:** *Active draft — repo-truth aligned*  
> **Scope:** Landing Express + Studio (Spec → Preview → Deploy)  
> **Non-goals (v0):** Full CRM, full omnichannel agents, full IaC autodeploy

---

## 0) Qué es esto y cómo se usa

Este documento es **la Tabla Madre** de BAX: el catálogo de *capabilities* que el sistema puede activar para un negocio.

- **Una landing = un objetivo primario** (**Mode**): `lead | booking | quote`.
- Todo lo demás es secundario, y **siempre existe un fallback a WhatsApp** (MX default).
- Una capability es un **módulo contractual**: tiene inputs, UI surface, eventos, DoD y reglas.
- El **código es el mismo**: lo que cambia es el **BusinessDNA** + flags de capabilities.

**Regla de operación:** para lanzar v0 y vender, necesitamos que **añadir una capability** sea “conectar un módulo”, no reescribir la landing.

---

## 1) Premisas v0 (no negociables)

1. **Mode único** por landing: `lead` *o* `booking` *o* `quote`.
2. **≤ 9 capabilities activas** en v0 por cliente (simplicidad operacional).
3. **Nada inventado:** claims/métricas solo con fuente (reseñas, enlaces, material del cliente).
4. **Mobile-first**; CTA siempre accesible; Core Web Vitals prioridad.
5. **Accesibilidad básica:** contraste, focus states, `prefers-reduced-motion`.
6. **Observabilidad mínima:** eventos de conversión y fuente de tráfico.
7. **Data mínima necesaria:** consentimiento y reducción de PII; nunca “aspirar” datos sin permiso.

---

## 2) Tabla Madre (Capability Map v0)

> **Ley:** *BusinessDNA* decide qué capabilities se activan y con qué configuración.  
> **Nota:** “Integraciones” en v0 suelen ser **link-outs** (WA / tel / calendar) o embeds simples.  

| Capability ID | Qué resuelve | Inputs mínimos (BusinessDNA) | UI module (Landing) | Eventos (Analytics) | KPI mínimo | Integraciones v0 |
|---|---|---|---|---|---|---|
| `hero_identity_block` | Identidad + promesa en 5s | `brand`, `offer`, `voice_tone`, `primary_cta` | Hero 60/40 + CTA | `cta_click`, `hero_view` | CTR CTA | WA/tel/link |
| `offer_showcase` | Qué vendes + por qué tú | `offers[]`, `differentiators[]` | Cards/sections | `section_view`, `offer_click` | Scroll depth | — |
| `primary_transaction` | Conversión principal (por Mode) | `mode`, `transaction_model`, `pricing_hint` | Booking/Lead/Quote module | `conversion_start`, `conversion_complete` | CVR | WA / Calendly / Stripe link / PDF |
| `trust_proof` | Confianza inmediata | `proof.reviews`, `proof.clients`, `proof.certifications` | Trust strip + testimonials | `proof_view` | Bounce ↓ | Google reviews link |
| `faq_support` | Reduce objeciones | `faq[]`, `policies[]` | FAQ + policies | `faq_expand` | Drop-off ↓ | — |
| `lead_capture` | Captura de lead (si aplica) | `lead.fields`, `routing` | Smart form + WA fallback | `lead_submit` | Leads/day | WA / email link |
| `location_router` | Multi-sucursal / geo | `locations[]`, `service_area` | Map/list + CTA per location | `location_select` | Calls per location | Maps |
| `content_engine_stub` | Contenido básico (sin “IA total”) | `assets`, `gallery[]` | Gallery + social links | `gallery_open` | Time on page | IG / TikTok |
| `analytics_core` | Instrumentación mínima | `tracking.plan` | (no UI) | `page_view`, `session_start`, `conversion_*` | Attribution clarity | GA4 / PostHog (si está) |

### Mapeo por Mode (v0)

- **Mode = `lead`**  
  Must: `hero_identity_block`, `offer_showcase`, `trust_proof`, `lead_capture`, `faq_support`, `analytics_core`  
  Optional: `location_router`, `content_engine_stub`

- **Mode = `booking`**  
  Must: `hero_identity_block`, `offer_showcase`, `trust_proof`, `primary_transaction`, `faq_support`, `analytics_core`  
  Optional: `location_router`, `content_engine_stub`

- **Mode = `quote`**  
  Must: `hero_identity_block`, `offer_showcase`, `trust_proof`, `primary_transaction`, `faq_support`, `analytics_core`  
  Optional: `lead_capture` (si el quote no cierra), `location_router`

---

## 3) Contrato de datos: cómo se conecta a BusinessDNA v1

**BusinessDNA v1** (fuente de verdad) define:

- `sector` (p.ej. `restaurant`, `professional_service`, `banquet_venue`)
- `mode` (lead/booking/quote)
- `offer` (servicios / paquetes)
- `brand` (paleta, tipografía, logo, tono)
- `channels` (WhatsApp, IG, tel, email)
- `locations` (si aplica)
- `proof` (reseñas, certificaciones, casos)
- `policies` (horarios, cancelaciones, FAQ)

**Regla:**  
> El *renderer* nunca debe depender de “texto suelto”. Todo sale de `BusinessDNA` o `LandingSpec` derivado.

---

## 4) Especificación por capability (v0)

> Formato estándar. Si una capability no cumple DoD, no se activa.

### 4.1 `hero_identity_block`

**Propósito:** comunicar identidad + promesa + CTA en ≤ 5 segundos.  
**Inputs (mínimos):**
- `brand.name`, `brand.logo`
- `offer.one_liner`, `offer.primary_benefit`
- `voice_tone`
- `primary_cta` (`label`, `href`, `channel`)

**UI rules:**
- Layout **60/40** desktop (copy/CTA izquierda, visual derecha), stack en mobile.
- CTA primary siempre visible above-the-fold.
- No “hero vacío”: siempre hay headline + subheadline + CTA + trust micro-strip.

**Eventos:**
- `hero_view` (once per session)
- `cta_click` `{channel, placement:"hero"}`

**DoD:**
- Lighthouse: sin CLS por hero.
- Contraste AA en texto principal.
- `prefers-reduced-motion`: no dependencias de scroll para ver el hero.

---

### 4.2 `offer_showcase`

**Propósito:** hacer tangible la oferta con estructura (no párrafos).  
**Inputs:** `offers[]` (nombre, bullets, precio “desde”, CTA secundaria), `differentiators[]`.

**UI rules:**
- Máximo 6 tarjetas arriba; si hay más, agrupar por categoría.
- Cada oferta debe responder: *qué incluye / para quién / siguiente paso*.

**Eventos:** `offer_click` `{offer_id}`, `section_view` `{section:"offers"}`  
**DoD:** oferta entendible sin scroll profundo; copy factual (sin claims inventados).

---

### 4.3 `primary_transaction`

**Propósito:** convertir. La UX depende del **Mode**.

#### Mode = `lead`
**UI module:** “Contact / Diagnóstico”  
- Botón WA + form corto (nombre + canal + intención + nota).  
- Fallback: `tel:` si el device no soporta WA.

**Eventos:** `conversion_start` `{mode:"lead"}`, `lead_submit`, `conversion_complete`  
**DoD:** lead submit confirma estado (success/fail); no bloquea navegación.

#### Mode = `booking`
**UI module:** “Reserva”  
- Embed calendly o link a OpenTable/Resy/Google Reserve.
- Reglas visibles: duración, política cancelación, ventana de atención.

**Eventos:** `conversion_start` `{mode:"booking"}`, `booking_click`, `conversion_complete`  
**DoD:** link/iframe funcional; copy de políticas consistente con FAQ.

#### Mode = `quote`
**UI module:** “Cotizador”  
- Formulario calculador v0: 3–7 variables, entrega rango + CTA a WA para cerrar.  
- Export v0: plantilla PDF *solo si* no rompe operación (opcional).

**Eventos:** `conversion_start` `{mode:"quote"}`, `quote_submit`, `conversion_complete`  
**DoD:** cálculo determinista; disclaimers (rango estimado); WA handoff con resumen.

---

### 4.4 `trust_proof`

**Propósito:** reducir riesgo percibido.  
**Inputs:** `proof.reviews[]`, `proof.rating`, `proof.clients[]`, `proof.metrics[]` (con fuente).

**UI rules:**
- Trust strip inmediato (rating + # reseñas + “ver fuentes”).
- Testimonios cortos: 1–2 líneas con nombre/fuente.

**Eventos:** `proof_view`, `proof_source_click`  
**DoD:** toda “métrica” tiene link o referencia verificable.

---

### 4.5 `faq_support`

**Propósito:** contestar objeciones y bajar tickets.  
**Inputs:** `faq[]` (pregunta/respuesta), `policies[]`.

**UI rules:**
- 6–10 FAQs máximo (v0); el resto a “Ver más / WhatsApp”.
- Políticas siempre cerca de transacción (booking/quote).

**Eventos:** `faq_expand` `{faq_id}`  
**DoD:** respuestas cortas y accionables; sin contradicciones con transacción.

---

### 4.6 `lead_capture` (si aplica)

**Propósito:** capturar lead cuando el usuario no está listo para comprar.  
**Inputs:** `lead.fields`, `routing` (email/wa).

**UI rules:**
- Form de 3–5 campos.
- Confirmación instantánea.
- No capturar PII innecesaria.

**Eventos:** `lead_submit`  
**DoD:** anti-spam básico (honeypot); mensajes claros.

---

### 4.7 `location_router` (si aplica)

**Propósito:** multi-sucursal / multi-brand simple.  
**Inputs:** `locations[]` (nombre, dirección, WA/tel, horarios).

**UI rules:**
- Selector de ubicación + CTA contextual.
- Mobile: lista scroll, no mapa pesado si no es necesario.

**Eventos:** `location_select` `{location_id}`  
**DoD:** cada location tiene CTA funcional; horarios consistentes.

---

### 4.8 `content_engine_stub`

**Propósito:** dar “vibe” y evidencia visual sin construir un CMS completo.  
**Inputs:** `gallery[]`, `social_links`.

**UI rules:** gallery ligera, lazy-load, assets optimizados.  
**Eventos:** `gallery_open`, `social_click`  
**DoD:** performance estable; nada pesado por default.

---

### 4.9 `analytics_core`

**Propósito:** observabilidad mínima para “build from reality”.  
**Inputs:** `tracking.plan` (provider, ids, events).

**Eventos obligatorios (v0):**
- `page_view` `{path, mode}`
- `session_start` `{referrer, utm?}`
- `cta_click` `{channel, placement}`
- `conversion_start` `{mode}`
- `conversion_complete` `{mode, channel}`
- `lead_submit` / `booking_click` / `quote_submit`

**DoD:** eventos sin PII; IDs del cliente en env vars; no bloquear render.

---

## 5) Event Map (payload mínimo)

> Los nombres son estables. Los payloads son pequeños y sin PII.

```json
{
  "event": "cta_click",
  "ts": "ISO-8601",
  "session_id": "uuid",
  "client_id": "bax_client_slug",
  "mode": "lead|booking|quote",
  "props": {
    "channel": "whatsapp|tel|form|calendar|stripe_link",
    "placement": "hero|sticky|section",
    "offer_id": "optional"
  }
}
```

---

## 6) Reglas de versionado

- `BusinessDNA`: versionado semver (`v1.0.0`…).
- `LandingSpec`: generado y versionado por cliente (`spec.json` con hash).
- Cambios en capabilities se registran en `changelog` por cliente.

---

## 7) Definition of Done global (capability-ready)

Una capability se considera **READY** si:

1. Tiene inputs claros (BusinessDNA).
2. Tiene UI surface definida (landing/studio).
3. Emite eventos mínimos.
4. Tiene fallback (WA/tel) si falla la integración.
5. Pasa `prefers-reduced-motion`.
6. No introduce CLS.
7. Tiene QA checklist.

---

## 8) Apéndice: Del v0 al moat (sin romper todo)

Cuando el runtime esté sólido, añadimos (por módulo, no por “sueño”):

- Agentes omnicanal (WA/IG/Web) **sobre el mismo event bus**.
- Quote builder avanzado (PDF, pagos, firma).
- Multi-tenant hub real (holding + sedes).
- Auto-instrumentation (GA4 + conversions) por “capability”.
- A/B testing engine.

**Regla:** no se “mete” una feature sin:
- contrato (inputs/outputs),
- DoD,
- y medición.

---
