# /docs/architecture/hybrid-repo-model.md
> **BAX — Hybrid Repo Model (v1)**
>
> **Goal:** operar **Landing Express** a volumen (10/semana) sin terminar con “mil repos sin control” *ni* un monolito inmanejable.  
> **Principio:** *separa el “motor” (platform) de los “outputs” (clientes)*, pero conserva un **camino orgánico** para cuando un cliente necesite **ownership** total.

---

## 0) Problema real (por qué existe este documento)

Hay dos extremos que rompen:

1) **Repo por cliente desde el día 1**  
   - ✅ Ownership claro  
   - ❌ Operación lenta (setup, deploy, fixes repetidos)  
   - ❌ No escalas a 10/semana sin un ejército

2) **Un solo repo para todo (multi-tenant total)**  
   - ✅ Velocidad para producir  
   - ❌ Clientes enterprise piden repo/ownership/seguridad/SLAs  
   - ❌ Si mezclas “plantilla” con “cliente”, el repo se ensucia

**Hybrid Repo Model** = **un core estable + outputs replicables** + **migración controlada** cuando el cliente crece.

---

## 1) Concepto: 3 niveles de repos (Platform → Output → Enterprise)

### Nivel A — **Platform Repo** (BAX Core)
El “motor” que no se negocia: composer, modules, runtime, contracts, build system.

- **Repo:** `bax-platform` (privado)
- **Contenido:**
  - `packages/ui` (componentes atómicos)
  - `packages/composer` (Composer v1)
  - `packages/schema` (BusinessDNA)
  - `packages/ops` (templates, DoD, scripts)
  - `apps/studio` (**NO tocar en Landing Express**, pero vive aquí si es core)
  - `apps/marketing` (la landing de BAX, si quieres mantenerla aquí)
- **Quién lo toca:** tú / equipo core (no clientes)

**Propósito:** evitar duplicación y mantener la fábrica consistente.

---

### Nivel B — **Client Output Repo** (Landing Express output)
Un repo generado desde plataforma para un cliente. “Thin” por default.

- **Repo:** `bax-client-<slug>` (privado o del cliente)
- **Contenido mínimo:**
  - `apps/web` (landing)
  - `spec/` (BusinessDNA + Composer config)
  - `content/` (assets + copy)
  - `deploy/` (vercel config)
  - `README.md` (handoff)
- **Relación con Platform:** **pinned release** (no “live link” sin control)

**Propósito:** entregar rápido con ownership opcional sin clonar la complejidad del core.

---

### Nivel C — **Enterprise Dedicated Repo** (custom systems)
Cuando el cliente pide:
- SSO, RBAC, multi-sede, CRM, integraciones profundas
- SLAs / compliance / security review
- control total de roadmap

Aquí ya no es Express. Se migra con un protocolo.

---

## 2) La pieza clave: **Release Pinning** (evitar caos)

El mayor error operativo es “cliente depende de main”.

### Regla
Todo output repo debe **pinnearse** a una versión exacta del motor.

Opciones (escoge 1):

1) **Template snapshot** (recomendado para Express)
- Generas el repo con código copiado desde un release/tag de `bax-platform`
- Queda “congelado” (hotfixes se aplican por PR dirigido)

2) **Git submodule / subtree**
- Más control, más fricción
- Útil si hay equipo técnico en el cliente

3) **NPM packages privados**
- Elegante, pero agrega complejidad (registry, versioning)
- Recomendado ya cuando haya más volumen o equipo

**Para 10/semana:** usa **Template snapshot** en MVP.

---

## 3) Estructura recomendada (MVP) — “Template Snapshot Factory”

### 3.1 Platform Repo (`bax-platform`)
```
bax-platform/
  packages/
    schema/              # BusinessDNA (zod/jsonschema)
    composer/            # reglas de composición
    ui/                  # componentes atómicos
    analytics/           # eventos y trackers
    ops/                 # plantillas, scripts
  templates/
    landing-express/     # template base para generar repos cliente
  tools/
    bax-cli/             # generador (opcional en MVP)
  docs/
```

### 3.2 Client Output Repo (`bax-client-<slug>`)
```
bax-client-<slug>/
  apps/
    web/                 # next app
  spec/
    business-dna.json
    composer.json
  content/
    brand/               # logo, paleta, fuentes
    media/               # fotos
    copy/                # copy.json o md
  deploy/
    vercel.json
  ops/
    acceptance.md        # checklist DoD + QA
  README.md              # handoff
```

---

## 4) ¿Cuándo es “un repo por cliente” vs “multi-tenant”?

### Landing Express (cashflow rápido)
✅ **Repo por cliente** (output thin)  
Razón: minimizas riesgo de “mezcla de data”, entregas ownership, y reduces fricción legal.

### Studio + data central + insights
✅ **Multi-tenant central** (BAX control)  
Razón: ahí vive el moat. No lo duplicas por cliente en MVP.

**Traducción:**  
- Los “assets” (landing) pueden ser por cliente.  
- La “mente” (signals, insights, composer runtime) se queda en BAX.

---

## 5) Data & Ownership (evitar problemas futuros)

### Qué vive en el repo del cliente
- UI + contenido + spec de su landing
- tracking IDs (si el cliente los provee)
- assets y copy aprobados

### Qué NO debe vivir en el repo del cliente (por default)
- logs de eventos de usuarios
- conversaciones de WhatsApp / mensajes
- datos personales sensibles
- modelos / prompts internos del agente

Eso vive en **BAX Control Plane** (multi-tenant), con consentimiento.

---

## 6) Protocolo de generación (operación diaria)

### Inputs (desde Studio)
- `business_dna.json`
- `composer.json`
- `assets/` (logo + fotos)
- `tracking.json` (si aplica)
- `mode` = lead|booking|quote

### Output
- repo nuevo en GitHub
- deploy automático en Vercel
- URL + handoff

### DoD “Repo Created”
- build pasa (lint + build)
- env vars configuradas
- preview URL funcionando
- QA checklist inicial ok

---

## 7) Hotfix & Updates (sin romper 10/semana)

### Política Express (7 días)
- Hotfix: bug fix o tracking fix
- No scope creep

### Cómo aplicas hotfix sin caos
- Cada cliente repo tiene branch `hotfix/<date>`
- PR con diff mínimo
- Tag interno de entrega: `deliver/<date>-v1`

---

## 8) Migración a Enterprise (cuando el cliente crece)

**Trigger conditions:**
- requiere RBAC, multi-sede real, integraciones complejas
- requiere owner infra + repos + security review
- volumen alto (miles de leads/mes) y quiere control

**Ruta recomendada:**
1) congelas landing express (no más cambios)
2) creas `enterprise-repo` (nuevo)
3) importas:
   - brand + copy + assets
   - business dna
   - analítica histórica (export)
4) implementas módulos enterprise como capabilities nuevas

**No “evolucionas” Express hasta enterprise dentro del mismo repo**:
eso genera deuda y rompe la fábrica.

---

## 9) “Qué forma es más orgánica para empezar” (respuesta CTO)

**MVP realista (cashflow + orden):**
- Mantén **1 Platform repo** + **N repos cliente output** (template snapshot)
- Sin submodules, sin registry, sin monorepo gigante por cliente
- En cuanto lleguen 20–30 clientes, introduces:
  - `bax-cli` (generador) o scripts
  - versioning por tags
  - checks automáticos de DoD

Esto te da velocidad hoy y te deja escalar sin reventar.

---

## 10) Guardrails (para que no colapse)

1) **Cada cliente tiene un único Mode primario** (lead/booking/quote).  
2) **Spec es la verdad**: cambios van por spec, no por “edita directo el UI”.  
3) **No se permite** que `bax-platform@main` alimente clientes directo.  
4) **DoD obligatorio** para cerrar trabajo.  
5) **Naming estándar** de repos, branches, tags.

---

## 11) Naming conventions (repos, branches, tags)

### Repos
- `bax-platform`
- `bax-client-<slug>` (ej: `bax-client-tacos-el-rey-cdmx`)

### Branching (cliente)
- `main` = estado live
- `work/<ticket>` = cambios
- `hotfix/<yyyy-mm-dd>` = ventana de hotfix

### Tags (cliente)
- `deliver/<yyyy-mm-dd>-v1`
- `hotfix/<yyyy-mm-dd>-v1`

---

## 12) Checklist de decisión (por cliente)

**Default = Output Repo.**  
Solo evalúa “no output repo” si:

- el cliente solo quiere “link a tu web” sin ownership (muy low ticket)
- o el cliente requiere multi-tenant con múltiples marcas desde día 1 (holding)

Si no, output repo wins.

---

## 13) Next step (cómo lo ejecutamos en el repo actual)

En el repo actual (landing-engine):
- Mantén `apps/studio` intocable.
- Define:
  - `templates/landing-express` (base)
  - `tools/scripts` para clonar/parametrizar
- Primeros 3 clientes: generación manual (controlada).
- A partir del 4–5: automatizas generación con script.

---

**Fin.**
