# /docs/mvp/roadmap.md
> **BAX — MVP Roadmap (Frontier Atomic, Build-from-Reality)**
>
> **Objetivo:** pasar de “idea” a **máquina operable de cashflow** (Landing Express) con una base técnica que permita escalar hacia **BAX-OS** (Agentes + Data + Composer) sin deuda estructural.
>
> **Regla de oro:** *No construimos features por imaginación.* Construimos **contracts + observabilidad + loops** para que la realidad nos diga qué sigue.

---

## 0) Definiciones rápidas (para alinear lenguaje)

- **Landing Express**: entrega rápida de una landing premium + tracking + CTA primario (Lead/Booking/Quote) con un proceso repetible.
- **Studio**: interfaz interna/cliente para intake → spec → preview → deploy (mínimo viable).
- **BusinessDNA**: verdad del negocio (oferta, identidad, transacción, operación) en JSON.
- **Composer**: reglas deterministas que componen la landing desde el spec (sin hardcode por cliente).
- **Control Plane (BAX)**: donde vive el “moat” (analytics, signals, insights, agent ops). *No se duplica por cliente en MVP.*
- **Output Repo (cliente)**: repo generado para el sitio del cliente (ownership), **pinned** a un release del motor.

---

## 1) North Star (lo que debe ser verdad cuando “MVP” existe)

**MVP existe si podemos:**
1) **Vender** Landing Express consistentemente (flujo de leads + cierre).
2) **Producir** 10/semana sin colapsar (ops + QA + handoffs).
3) **Medir** conversiones y outcomes con un esquema estándar (events + funnels).
4) **Aprender** de la data para mejorar el producto (feedback loop real).

---

## 2) Roadmap por fases (sin fechas, solo gates medibles)

### Fase 0 — Foundation Lock (Base no negociable)
**Outcome:** todo el equipo opera sobre los mismos contratos y estructura.

**Deliverables**
- `/docs/manifesto.md` (ya)
- `/docs/capability-map-v0.md` (ya)
- `/docs/ops/landing-express.md` (ya)
- `/docs/architecture/hybrid-repo-model.md` (ya)
- **Repo structure** preparada para outputs (plantillas + scripts)
- **Spec contracts** aplicados: BusinessDNA v1 + Composer v1

**Exit Criteria**
- Existe un “happy path” documentado de punta a punta (intake → spec → deploy).
- Un cliente demo puede generarse sin “magia” manual fuera del proceso.

---

### Fase 1 — Landing Express Engine (Cashflow Core)
**Outcome:** BAX puede cerrar y entregar landings premium con consistencia.

**Lo mínimo que debe funcionar**
- 3 modos: **Lead / Booking / Quote** (sin inventar más).
- 1 template base “Frontier” con variantes por modo (no por industria).
- Instrumentación analítica mínima y estándar.
- QA checklist repetible.

**Exit Criteria**
- 3 entregas reales (pagadas o beta de alta intención) completadas con DoD.
- Cada entrega tiene: spec versionado + deploy + analytics + handoff.

---

### Fase 2 — Studio MVP (Spec → Preview → Deploy)
**Outcome:** el trabajo manual se convierte en “operación con UI”.

**Scope MVP (estricto)**
- Intake UI (12–18 preguntas por Mode) → genera BusinessDNA
- Preview (render) determinista desde Composer
- Deploy (manual asistido o semi-auto) con checklist y estados
- Panel “Assets” (logo/fotos/copy) mínimo

**Exit Criteria**
- 80% del trabajo de crear landing ocurre dentro de Studio.
- Se puede entrenar a un operador (no dev) a producir una entrega.

---

### Fase 3 — Signal Capture (Moat v0)
**Outcome:** empezamos a “refinar señal” sin prometer AGI.

**Scope**
- Event schema único + collector (PostHog/GA4 o equivalente)
- Dashboard interno: CVR, CTA clicks, form submits, booking starts, quote submits
- Feedback loop: “top objections / top intents” por cliente

**Exit Criteria**
- Podemos decir con evidencia qué cambia conversiones.
- Los cambios a templates se deciden por datos, no por gusto.

---

### Fase 4 — Agents v0 (Revenue Expansion)
**Outcome:** upsell natural desde landing hacia agente que reduce trabajo real.

**Scope MVP de agentes**
- **Inbound Agent (FAQ + lead capture)** en web
- **WhatsApp Agent (follow-up)** solo para 1–2 flows críticos
- Guardrails: handoff a humano, disclaimers, logs, consentimiento

**Exit Criteria**
- Un cliente obtiene mejora medible: +CVR o -tiempo humano en seguimiento.
- Operación soporta tickets de “agent tuning” sin romper entregas.

---

### Fase 5 — Multi-Brand Hub (Holding / Grupos)
**Outcome:** caso enterprise-lite (grupos restauranteros, 5 sedes, etc.) sin reescribir todo.

**Scope**
- BusinessDNA soporta “group + locations”
- Landing: group page + location router + 1–N sub-landings
- Analytics consolidado por grupo

**Exit Criteria**
- 1 cliente multi-sede funciona end-to-end sin inventar arquitectura nueva.

---

## 3) Sprint Train (2–3 sprints por semana) — cómo lo ejecutamos sin desmadre

### Sprint Cadence (operativa)
- **Sprint A (Build):** implementar tickets atómicos
- **Sprint B (Ship):** QA + deploy + hardening
- **Sprint C (Learn):** instrumentación + análisis + ajustes por data (si aplica)

> *No todos los ciclos requieren C; pero A y B son obligatorios si hay shipping.*

### Regla de gating
- No se abre trabajo “nuevo” si hay:
  - build roto
  - QA pendiente
  - DoD incompleto
  - deuda de documentación crítica

---

## 4) Backlog Prioritization (la regla para decir NO)

Priorizamos por este orden:

1) **Cashflow enablement** (capta lead / cierra / entrega)
2) **Throughput** (reduce tiempo por landing)
3) **Reliability** (builds, QA, safety, rollback)
4) **Signal** (instrumentación y medición)
5) **Expansion** (agents, multi-brand, insights avanzados)

Todo lo que no caiga en 1–3 es “Later” hasta que haya señal.

---

## 5) Milestones operativos (qué debe pasar en la vida real)

### Milestone M1 — “Vender sin vergüenza”
- Demo convincente (static) + theatre opcional (no arriesga conversion)
- Pricing/tiering claro
- Intake claro y rápido
- Primeros casos reales (servicios/restaurantes/banquetes)

### Milestone M2 — “Producir 10/semana”
- SOP y checklist operativos
- Repo model híbrido funcionando
- Plantillas sólidas
- QA rápido y estandarizado

### Milestone M3 — “Aprender por data”
- Funnel end-to-end medible
- Cambios a templates basados en experimentos

### Milestone M4 — “Upsell agent”
- Agente inbound con guardrails
- WhatsApp follow-up con logs y consentimiento

---

## 6) KPIs v0 (medimos lo que importa, no vanity)

### KPIs de BAX (internos)
- **Lead velocity:** leads/semana por canal
- **Close rate:** % leads → pago
- **Cycle time:** intake → deploy (p50, p90)
- **Throughput:** landings entregadas/semana
- **Rework rate:** % entregas con cambios post-handoff
- **Gross margin proxy:** horas invertidas por entrega

### KPIs por cliente (outcome)
- **CTA CTR** (click-through del CTA primario)
- **Primary conversion** (submit lead / booking start / quote submit)
- **Time-to-first-response** (si hay agente)
- **Show-up rate** (si booking)
- **Quote-to-close** (si quote)

---

## 7) Go-to-Market (MVP) — simple, repetible, sin overengineering

### Target inicial (donde duele y pagan)
- **Servicios profesionales** (dentistas, abogados, clínicas)
- **Restaurantes** (reservas + WA + menú)
- **Salones/banquetes** (quote builder básico + lead qualification)

### Oferta de entrada (Landing Express)
- Un solo objetivo primario (Lead/Booking/Quote)
- 72h “confidence window” operativa (calidad > speed extrema)
- 1 ronda incluida; extra rounds como upsell (control de scope)

### Upsell natural
- Agent inbound + WA follow-up (si el cliente tiene volumen)
- Multi-brand hub (si holding)
- Integraciones (si ya usan sistemas y tienen presupuesto)

---

## 8) Riesgos reales (y cómo no morir)

1) **Scope creep por cliente**
   - Mitigación: DoD + 1 objetivo primario + change orders.

2) **“Template hell”**
   - Mitigación: Composer + spec-driven UI + no forks sin razón.

3) **Data/privacidad**
   - Mitigación: consentimiento explícito, mínimo dato, logs, separación control plane vs output repos.

4) **Dependencia de WebGL/theatre**
   - Mitigación: modo `static` como default; theatre como feature opcional.

5) **Explosión de repos**
   - Mitigación: Hybrid repo model + naming + tagging + automation gradual.

---

## 9) Artefactos que deben mantenerse vivos (living docs)

- `/docs/manifesto.md` — identidad y narrativa
- `/docs/capability-map-v0.md` — mapa de módulos
- `/docs/ops/landing-express.md` — SOP operativo
- `/docs/architecture/hybrid-repo-model.md` — escalabilidad y ownership
- `/docs/mvp/roadmap.md` — este documento
- `/docs/decision-log.md` — decisiones irreversibles y por qué
- `/docs/event-schema.md` — single source of truth de analytics

---

## 10) “What’s next” (en forma de gates, no fantasía)

**Si hoy tuviéramos que elegir 3 cosas para ejecutar ya:**
1) Landing Express Engine (Lead/Booking/Quote) con DoD y QA
2) Repo generation (template snapshot) + deploy path estable
3) Event schema v0 + dashboard mínimo (para aprender)

Cuando esos 3 estén sólidos, el producto empieza a guiarse por realidad.

---

**Fin.**
