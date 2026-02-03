# BAX Manifesto v0.1 — *Built from Reality*

**Fecha:** 2026-02-03  
**Owner:** Fundador + CTO (BAX War Room)  
**Estatus:** Activo (documento rector).  
**Ámbito:** Define el *qué*, *por qué* y *cómo* de BAX. Este documento manda sobre cualquier implementación.

---

## 0) TL;DR

BAX no es una agencia, un “builder” visual, ni un CMS genérico.  
BAX es una **Fábrica Horizontal** que convierte señal dispersa de un negocio en **Cashflow Autónomo** mediante:

1) **Landing Express** (cash rápido y repetible)  
2) **Studio** como *Spec Factory* (captura y estructura de verdad del negocio)  
3) **Composer Runtime** (composición gobernada por reglas, no por ocurrencias)  
4) **Reality Loop** (telemetría mínima + export/iteración) para que el producto se construya con evidencia y no con ideas.

> **Tesis:** Todos los negocios están hechos de los mismos átomos: **Oferta**, **Transacción**, **Identidad**, **Operación**.  
> BAX no “diseña páginas”; **ensambla capacidades**.

---

## 1) North Star

### 1.1 La promesa en 5 segundos (C-Board narrative)

Un negocio típico vive en entropía digital:
- su marketing dice una cosa,
- su WhatsApp atiende como puede,
- sus reservas/cotizaciones son manuales,
- y sus datos están fragmentados (IG, Maps, OpenTable, llamadas, hojas de cálculo).

**BAX llega y lo convierte en un sistema operativo comercial**:

- **En 72 horas** el negocio tiene una **Landing Premium** que **convierte**, con WhatsApp y medición mínima.
- En semanas, BAX agrega módulos: **Agentes**, **quote/booking**, **content engine**, **CRM/insights**.
- En meses, BAX se vuelve el empleado digital que **no duerme**, **no se equivoca por falta de contexto**, y convierte datos en decisiones.

### 1.2 Qué significa “World Class / Frontier”

No significa “tener 40 features”.  
Significa **tener un Runtime tan sólido** que agregar un feature sea “activar un módulo” y no crear caos.

**Frontier =**
- Repetible (10/semana sin desmadre)
- Medible (cada entrega mejora el sistema)
- Debuggable (cambios auditables)
- Escalable (sin deuda arquitectónica)
- Vendible (valor obvio desde el primer paint)

---

## 2) Identidad: de “Agencia” a “Refinería”

### 2.1 La refinería

BAX refina **señal** → **infraestructura**.

- **Entrada:** Links, assets, intención, operación real, pruebas, restricciones.
- **Refinación:** BusinessDNA (schema) + reglas de composición.
- **Salida:** Landing/Activos + agentes + instrumentación + playbooks.

### 2.2 Qué NO somos (no negociable)

- No somos “sitios a la medida” por capricho.
- No hacemos “todo para todos” en el MVP.
- No aceptamos scope creep que rompa la fábrica.
- No vendemos features sin DoD medible.
- No construimos integraciones enterprise en Landing Express.
- No construimos un builder visual libre en MVP.

---

## 3) Principios operativos (Built from Reality)

### 3.1 Reality > Ideas

Las decisiones de producto se toman por:
- evidencia de operación,
- telemetría (aunque sea mínima),
- conversiones reales,
- fricción observada,
- tickets repetidos,
- datos externos con consentimiento.

**Regla:** si una idea no tiene:
- hipótesis testable,
- métrica,
- y plan de captura de señal,  
no entra al core.

### 3.2 Rendimiento y estabilidad como feature

- CLS cercano a 0
- primera impresión legible y con CTA
- degradación elegante (reduced motion / webgl off)
- “no empty states”
- build always green

### 3.3 Seguridad, privacidad y cumplimiento (consent-first)

- Ingesta agresiva **solo donde sea legal y ético**.
- Preferimos APIs oficiales y permisos explícitos (OAuth) frente a hacks.
- Mínimo dato necesario; no retenemos PII sin razón.
- Auditoría de cambios (qué generó la IA, qué cambió un humano, cuándo y por qué).

---

## 4) Los 4 contratos (la arquitectura que evita espagueti)

Todo en BAX se organiza en **contratos** que separan logística, lógica y entrega.

### 4.1 Intake Contract (Input → BusinessDNA)

Define:
- qué preguntamos,
- cómo validamos,
- qué es obligatorio,
- y qué se rechaza.

**Output:** `business_dna.json` + `intake_proof.json` (evidencia mínima).

### 4.2 BusinessDNA Contract (Verdad estructurada)

Es el “genoma” del negocio, independiente de UI.

- sector / vertical
- goal primary (Mode)
- offer / pricing model (alto nivel)
- channels (WA/IG/Web/Calls)
- constraints (horarios, zonas, políticas)
- brand voice / palette / assets
- compliance disclaimers

### 4.3 Composer Contract (DNA → LandingSpec)

Toma BusinessDNA + reglas y genera:

- `landing_spec.json` (renderizable)
- `event_map.json` (instrumentación mínima)
- `qa_checklist.md` (operativo)
- `preview_url` (si aplica)

**Composer no improvisa:** compone en base a una biblioteca atómica + reglas.

### 4.4 Deploy Contract (Spec → Activo en producción)

Produce:
- deploy en factory environment **o**
- export a repo del cliente (premium)

Incluye:
- env vars,
- dominios,
- health checks,
- rollback policy,
- ownership docs.

---

## 5) El producto MVP (lo que sí hacemos ya para vender)

### 5.1 BAX Landing Express (cashflow engine)

**Entrega:** landing premium con un objetivo primario, instrumentación mínima y canal de cierre (WA).

**SLA objetivo:** 72h (express real, sin sacrificar calidad).  
**Rondas:** 1 ronda timeboxed.  
**Scope:** definido, cerrado, repetible.

#### Modos (Mode = objetivo primario)

- **Lead Mode**: formulario + WA + captación de intención.
- **Booking Mode**: booking *link-out* (OpenTable/Calendly/WhatsApp) + intent capture.
- **Quote Mode**: formulario estructurado + WA fallback + PDF opcional en fases posteriores.

**Regla dura:** 1 landing = 1 modo.  
El resto son secundarios (no compiten por atención).

### 5.2 Studio (MVP) = Spec Factory, no builder libre

Studio en MVP:
- guía intake,
- valida BusinessDNA,
- muestra preview,
- permite ajustar campos guardraileados,
- genera export y handoff.

Studio en MVP **NO**:
- no es un editor visual libre tipo Webflow
- no es un CMS abierto
- no permite re-arquitecturar la landing a voluntad

### 5.3 Composer Runtime (MVP) = reglas + biblioteca atómica

- 8 secciones “Express” en orden fijo (con variaciones internas).
- copy skeleton por sección.
- CTA repetido estratégicamente.
- trust strip y evidencia (si no hay evidencia, no se afirma).

---

## 6) La visión completa (hacia BAX-OS)

Landing Express es el primer producto vendible.
La visión es evolucionar a BAX-OS:

### 6.1 BAX-OS: de landing a sistema operativo comercial

- **Activos:** web(s) + páginas de campaña + microfunnels
- **Agentes:** inbound/outbound, WA/web, escalación humana
- **Datos:** bus de eventos, atribución mínima, scorecards
- **Crecimiento:** recomendaciones accionables (no dashboards inútiles)

### 6.2 Enfoque inicial de verticales (para operar con verdad)

Para el comienzo, optimizamos para:
- **Servicios profesionales**
- **Restaurantes**
- **Salones / banquetes / eventos**

Pero el **motor** se diseña horizontal: la estructura sirve a cualquier negocio,
y la operación se expande con evidencia.

---

## 7) Modelo operacional: cómo producimos 10/semana sin rompernos

### 7.1 Cadencia

- 2 sprints por semana (atómicos, DoD estricto)
- carril de incidentes con WIP=1
- ritual de release con checklist

### 7.2 Gates (evitan caos)

**Gate 0: Intake complete**
- faltantes → no entra a producción

**Gate 1: Spec complete**
- BusinessDNA validado
- assets mínimos
- modo definido
- disclaimers definidos

**Gate 2: Preview ready**
- landing renderiza
- CTA funciona
- eventos mínimos disparan
- mobile OK

**Gate 3: Deploy safe**
- build green
- dominio/ssl si aplica
- health check
- handoff doc

### 7.3 Definition of Done (DoD) universal

Una entrega está “done” cuando:
- se ve premium en móvil y desktop
- el objetivo primario está claro
- CTA funciona y está aislado de overlays
- performance y CLS están controlados
- reduced motion se ve completo (no “vacío”)
- telemetría mínima registrada
- QA checklist firmada

---

## 8) “Reality Loop” (el foso / moat real)

El moat no es UI. El moat es:
- la data de comportamiento,
- los patrones de conversión por vertical,
- y el aprendizaje operacional.

### 8.1 Telemetría mínima (MVP)

Capturamos:
- view_section
- click_primary_cta
- submit_lead / start_booking / request_quote
- whatsapp_click
- scroll_depth milestones
- source/utm

Nada de esto requiere “enterprise analytics”. Requiere disciplina.

### 8.2 Aprendizaje útil (no vanity)

Cada semana:
- top 10 fricciones observadas
- top 10 hipótesis de mejora
- 1–2 experimentos máximos (A/B) cuando ya haya volumen
- mejoras se convierten en reglas del Composer

---

## 9) Economía y ventas (cómo ganamos dinero sin sufrir)

### 9.1 Estrategia de cashflow

**Producto base:** Landing Express (one-time + setup).  
**Retención:** hosting/ops + mejoras menores + canal WA + reporting mínimo.  
**Upsells:** Agent pack, content engine, quote engine, analytics pack, integrations.

### 9.2 Regla anti-autoboicot

BAX no se vende como “todo infinito”.  
Se vende como:
- entrega rápida,
- evidencia de valor,
- y escalamiento por módulos.

---

## 10) Decisiones duras (candados) — *No Drift*

Estas decisiones se congelan para evitar caos.

### D1 — Studio en MVP

**Studio = Spec Factory (guardrailed)**, no builder libre.  
Cualquier request de “editor visual total” se considera producto futuro.

### D2 — Modos (Lead/Booking/Quote)

MVP soporta los 3, pero **Lead se vuelve perfecto primero**.  
Booking/Quote deben ser vendibles sin integraciones profundas.

### D3 — Deploy/Repos

Modelo híbrido:
- **Factory Deploy** por default (rápido, cashflow).
- **Ownership Export** premium (repo del cliente) cuando sea requisito.

---

## 11) Diseño de la experiencia (la narrativa que debe sentirse)

En el “primer paint” la landing de BAX debe transmitir:

1) **Autoridad:** “Esto no es una agencia más.”
2) **Claridad:** “Sé exactamente qué vas a obtener en 72h.”
3) **Certeza:** “Hay un proceso; no hay improvisación.”
4) **Acción:** “El primer paso es mínimo; el sistema hace el resto.”

---

## 12) Cultura del equipo (cómo trabajamos con Codex)

### 12.1 Codex como “ejecutor con guardrails”

Codex no decide la visión.  
Codex ejecuta tickets con:
- DoD medible,
- constraints explícitos,
- y rollback claro.

### 12.2 Reglas de trabajo

- Un cambio = un ticket atómico.
- Toda modificación importante actualiza docs y/o schema.
- Build green siempre.
- Cada sprint deja el sistema más simple, no más complejo.

---

## 13) Checklist de coherencia (antes de escribir código)

Antes de un sprint, confirmamos:

- ¿Qué parte del sistema cambia?
- ¿Qué contrato toca (intake / dna / composer / deploy)?
- ¿Cuál es el DoD y la métrica?
- ¿Qué señales capturamos para validar?
- ¿Qué se puede romper?
- ¿Qué rollback existe?

Si no podemos contestar esto, no implementamos.

---

## 14) Conclusión

BAX es una máquina para imprimir máquinas de dinero, construida con realidad operativa.

**Hoy:** Landing Express + Studio Spec Factory + Composer v1 + Telemetry v0  
**Mañana:** agentes y módulos por evidencia  
**Siempre:** runtime sólido, guardrails estrictos, y evolución guiada por señal.

---

## Apéndice A — Glosario mínimo

- **Mode:** objetivo primario de conversión (Lead/Booking/Quote).
- **BusinessDNA:** verdad estructurada del negocio (schema).
- **Composer:** motor que compone la landing desde reglas.
- **Spec:** representación renderizable de la landing.
- **Factory Deploy:** deploy en infraestructura controlada por BAX.
- **Ownership Export:** export a repo del cliente (premium).
- **Reality Loop:** telemetría + aprendizaje + reglas.

---

## Apéndice B — Postura ante las “40 ideas”

Las ideas son backlog potencial, no scope del MVP.

**Regla:** una idea entra cuando:
- la realidad la pide (datos),
- hay capacidad/contrato para soportarla,
- y existe DoD + métrica.

De lo contrario, es deuda cognitiva.
