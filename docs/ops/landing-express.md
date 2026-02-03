# /docs/ops/landing-express.md
> **BAX — Landing Express Ops Playbook (v1)**
>
> **Purpose:** producir landings premium en volumen (objetivo: **10/semana**) con calidad consistente, bajo un sistema operativo claro y auditable.  
> **Scope:** *Landing Express* (web/landing + tracking + handoff a WhatsApp/call/booking/quote).  
> **Non-goals:** CRM completo, omnichannel agents completos, integraciones enterprise (eso es upsell).  
> **Principio rector:** *Build from reality*: medir primero, mejorar después; no “feature creep”.

---

## 0) Definiciones rápidas

- **Landing Express:** entrega rápida, única vez (pago único), con un **Mode** primario:
  - `lead` (captura + WhatsApp)
  - `booking` (reservas)
  - `quote` (cotización express)
- **BusinessDNA v1:** JSON de verdad del negocio.
- **Composer v1:** reglas de composición de la landing.
- **Studio:** donde se ingesta, valida y produce Spec → Preview → Deploy.
- **DoD:** Definition of Done: si no cumple, no se entrega.

---

## 1) Oferta operable (qué vendemos exacto)

### 1.1 Lo que SI incluye (v1)

**Entrega en 72h (estándar) desde Intake Complete:**
1. **Landing premium** (mobile-first) con:
   - Hero + CTA principal
   - Oferta/servicios (6 max arriba)
   - Trust proof (reseñas / logos / fuentes)
   - FAQ/Políticas
   - Sección transaccional según Mode (`lead|booking|quote`)
   - Footer con contacto
2. **1 integración primaria (link-out o embed)** según Mode:
   - `lead`: WhatsApp + `tel:` fallback + form corto
   - `booking`: Calendly/OpenTable/Resy/Google Reserve (embed o link)
   - `quote`: form calculador simple (3–7 variables) + WA handoff con resumen
3. **Instrumentación mínima** (Analytics Core):
   - Eventos: `cta_click`, `conversion_start`, `conversion_complete`, `lead_submit|booking_click|quote_submit`
4. **SEO básico:** title/description, OG tags, schema básico (LocalBusiness / ProfessionalService / Restaurant si aplica).
5. **Hosting en infra del cliente** (si aplica) o en BAX (temporal) con handoff.

**Revisión:** 1 ronda incluida (cambios en copy/orden/activos, sin scope creep).  
**Soporte:** 7 días de “hotfix window” (bugs, no cambios de contenido).

---

### 1.2 Lo que NO incluye (para evitar desmadre)

- Cambios de branding completos (rediseño de logo, identidad completa).
- Copywriting “de agencia” con 10 rondas.
- Integraciones profundas (CRM bidireccional, inventario, pasarelas complejas).
- Automatizaciones multi-canal (IG/WA/calls) en v1 Express (eso es upsell).
- Multi-idioma (upsell).
- Multi-sede avanzado (holding + sedes) salvo paquete específico.

**Regla anti-colapso:** si algo requiere **reunión técnica**, ya no es Express.

---

## 2) Tiers sugeridos (para vender sin matar operación)

> No es “barato vs caro”. Es **riesgo operable vs complejidad**.

### Tier S — Express Starter (Lead)
- Mode: `lead`
- Entrega: 72h
- 1 CTA (WA/tel) + form corto
- Tracking básico

### Tier M — Express Pro (Booking o Quote simple)
- Mode: `booking` o `quote`
- Entrega: 72h (o 96h si quote variables >5)
- Embed / link-out (booking) o calculador simple (quote)
- Tracking + sección trust fuerte

### Tier L — Express Plus (Holding / multi-sucursal básico)
- Mode: `lead` o `booking`
- 1 “hub” + 2–5 locations (router)
- Entrega: 5–7 días
- Tracking por location

**Pricing rule of thumb (operativa):**
- Precio base = *horas reales* × *rate* + margen por riesgo.
- Si el cliente quiere “todo”, se manda a **Discovery/Scope** (no Express).

---

## 3) Intake (cómo evitar el caos desde el minuto 0)

### 3.1 Estados del cliente (pipeline)

1. **Inbound** (lead entrante)  
2. **Qualified** (califica)  
3. **Paid** (pago confirmado)  
4. **Intake Pending**  
5. **Intake Complete** ✅ (se congela scope)  
6. **Spec Ready** ✅  
7. **Preview Ready** ✅  
8. **Deploy Safe** ✅  
9. **Delivered** ✅  
10. **Hotfix Window** (7 días)  
11. **Closed** (o Upsell)

**Regla:** No se inicia producción antes de **Intake Complete**.

---

### 3.2 Preguntas mínimas (12–18) por Mode (v1)

> Formato: respuesta corta. Si el cliente no sabe, damos opciones (A/B/C).  
> Objetivo: eliminar la llamada de briefing.

#### Mode: LEAD (Servicios profesionales)
1) Nombre del negocio + ciudad/zona  
2) ¿Qué vendes en 1 frase?  
3) Top 3 servicios (y para quién)  
4) Ticket promedio (rango) o “desde”  
5) CTA principal: WhatsApp / llamada / formulario  
6) Horarios de atención (y tiempos de respuesta)  
7) Zona de servicio (área)  
8) Diferenciadores reales (3)  
9) Objección #1 que frena la venta (precio, confianza, tiempos)  
10) Pruebas: reseñas, casos, certificaciones (links)  
11) Fotos/activos (carpeta, IG, sitio viejo)  
12) Políticas básicas (citas, cancelación, garantías)  
13) ¿Qué “lead bueno” quieres? (perfil ideal)  
14) Competidor local #1 (link)  
15) Tonalidad: formal / friendly / premium / directa  
16) Color/acento (si tienen)

#### Mode: BOOKING (Restaurante / salón)
1) Nombre + ciudad  
2) Tipo: restaurante / salón / ambos  
3) Link de reservas actual (OpenTable/Calendly/WhatsApp)  
4) Horarios y días  
5) Capacidad / turnos (si aplica)  
6) Políticas (anticipo, cancelación, tolerancia)  
7) CTA principal (Reservar / Cotizar / Visitar)  
8) Menú/paquetes (link o PDF)  
9) Reseñas + rating (links)  
10) Fotos del lugar / montajes (IG o drive)  
11) Ubicación + Google Maps  
12) Preguntas frecuentes (6) (si no, las generamos y validas 1 ronda)  
13) Tonalidad y estilo (premium/casual)  
14) “Momento de decisión” (boda/15 años/corporativo)  
15) Competidores locales (2)  
16) Mensaje de confirmación (qué prometes al reservar)

#### Mode: QUOTE (Banquetes / construcción / servicios)
1) Nombre + ciudad  
2) Qué cotizas (servicio principal)  
3) Variables del quote (3–7) (ej: personas, fecha, tipo montaje, horas)  
4) Rango base (mínimo y máximo)  
5) Qué incluye / qué no incluye  
6) SLA de respuesta (tiempo)  
7) CTA: “Enviar a WhatsApp” + PDF (opcional)  
8) Políticas (anticipo, cambios)  
9) Casos / portafolio (links)  
10) Reseñas / clientes (links)  
11) Fotos de montajes/obras  
12) Zonas de servicio  
13) Preguntas frecuentes de cotización  
14) Competidor #1  
15) Tonalidad  
16) Contacto de cierre (WA + nombre)

---

### 3.3 “Intake Complete” (Definition of Done)

- Todas las preguntas mínimas respondidas.
- Activos base disponibles (logo o nombre tipográfico + 6 fotos mín).
- Mode elegido (uno).
- 1 CTA principal definido.
- 1 ronda de revisión confirmada (aceptan reglas).
- Pago confirmado.

**Si falta algo:** se activa “Assisted Intake” (BAX ayuda, pero el reloj no corre).

---

## 4) Producción (cómo fabricar 10/semana)

### 4.1 Roles mínimos (equipo pequeño)

- **Producer (Ops):** controla pipeline, deadlines, bloqueo de scope.
- **Builder (Dev/Front):** implementa landing + tracking + deploy.
- **Editor (Copy/UX):** revisa copy, estructura, consistencia y CTA.
- **QA (puede ser Producer en v1):** checklist y validación final.

> Con 2–3 personas, se puede llegar a 10/semana si el intake está fuerte.

---

### 4.2 Timeboxing por entrega (72h)

**Día 0 (T0): Intake Complete**
- Producer crea el “Job” + carpeta + spec.
- Se asigna slot en sprint.

**Día 1 (0–24h): Spec Ready**
- BusinessDNA v1 se genera/valida.
- Composer v1 selecciona módulos y orden.
- Copy skeleton se arma con evidencia (reseñas/links).
- QA rápido de inputs.

**Día 2 (24–48h): Preview Ready**
- Landing render + responsiveness.
- CTA + WA handoff + eventos.
- Visual assets integrados.
- Revisión interna (Editor).

**Día 3 (48–72h): Deploy Safe → Delivered**
- Perf pass (LCP/CLS) y accesibilidad base.
- SEO/OG/Schema.
- Deploy.
- Entrega al cliente + instrucciones.

**Revisión:** 1 ronda (24h turnaround).  
**Hotfix:** 7 días.

---

## 5) Checklist Operativo Interno (cero desmadre)

### 5.1 Antes de tocar código (Producer)

- [ ] Pago confirmado
- [ ] Mode definido (uno)
- [ ] CTA principal definido (WA/tel/booking/quote)
- [ ] Activos mínimos listos (logo/colores/fotos)
- [ ] Links de pruebas (reseñas, maps, IG)
- [ ] Políticas base confirmadas
- [ ] Competidores (1–2) para benchmark rápido
- [ ] “Definition of Done” aceptado por cliente (scope congelado)

### 5.2 Spec Ready (Builder + Editor)

- [ ] BusinessDNA v1 completo y validado (sin “TBD” críticos)
- [ ] Estructura de landing según Composer v1 (orden)
- [ ] Copy skeleton factual (sin claims inventados)
- [ ] Trust strip con fuentes
- [ ] FAQs (6–10) y policies alineadas con Mode

### 5.3 Preview Ready (Builder)

- [ ] Hero above-the-fold con CTA visible
- [ ] Mobile: CTA accesible sin scroll infinito
- [ ] Eventos instrumentados (`cta_click`, `conversion_*`)
- [ ] WA handoff incluye resumen (quote/booking)
- [ ] Imágenes optimizadas (next/image o equivalente)
- [ ] Reduced-motion: no depende de scroll/animaciones para entender la oferta

### 5.4 Deploy Safe (QA)

- [ ] Lighthouse (mínimo): CLS ~0, LCP aceptable
- [ ] Contraste AA en textos críticos
- [ ] Focus states (tab)
- [ ] SEO tags + OG + favicon
- [ ] Schema básico correcto por sector
- [ ] Links (tel, wa, maps) funcionan
- [ ] Prueba de “modo incógnito” (sin cache)
- [ ] Entrega con checklist + acceso

---

## 6) Handoff al cliente (entrega sin fricción)

**Entregables (correo/WhatsApp):**
1) URL live
2) 3 CTAs principales y dónde llevan
3) Acceso / instrucciones (si aplica)
4) Qué medir:
   - clics a WA
   - submissions
   - bookings
5) Siguiente paso recomendado (upsell basado en realidad)

**Script de entrega (corto):**
- “Tu landing ya está viva. El objetivo es X (Mode). Entra por aquí y prueba: CTA + conversion. En 7 días te mandamos un mini-reporte con eventos y te proponemos el primer upgrade basado en datos.”

---

## 7) Política anti-scope-creep (para proteger cashflow)

**Regla de oro:**  
> Si el cambio altera Mode, transacción, o requiere una integración nueva, **no es Express**.

- Cambios permitidos (1 ronda):
  - copy, orden de secciones, fotos, textos, FAQs, precios “desde”
- Cambios NO permitidos:
  - “metamos checkout”, “metamos CRM”, “hagamos multi-idioma”, “hagamos 10 páginas”

**Respuesta estándar:**
- “Eso es un upgrade. Te lo cotizamos como módulo adicional.”

---

## 8) Upsell playbook (build from reality)

> Solo se vende upgrade si hay señal.

### Señales típicas → Upgrade sugerido
- Mucho `cta_click` y pocos `conversion_complete` → mejorar oferta/FAQ/A-B test (v1.1)
- Muchos leads repetidos en WA → agente inbound (v1.5)
- Multi-sucursal confusa → Location Router + holding hub
- Quote complejo manual → Quote Builder v2 (PDF + pagos)

**Regla:** upgrade = 1 capability nueva, no 10 features.

---

## 9) Métricas internas BAX (para operar como fábrica)

- **Cycle time:** Intake Complete → Delivered (target ≤ 72h)
- **WIP:** trabajos en paralelo (target 3–5)
- **Defects:** hotfixes por entrega (target < 1)
- **Revision rate:** % que usa la 1 ronda (target < 60%)
- **Conversion KPI (por cliente):** baseline `cta_click` y `conversion_complete`

---

## 10) Plantillas de comunicación (para velocidad)

### 10.1 “Falta Intake”
> Para iniciar necesitamos: (1) CTA principal, (2) 6 fotos, (3) link de reseñas, (4) horarios, (5) servicios top 3. En cuanto esté, corren las 72h.

### 10.2 “Scope freeze”
> Confirmo: Mode = X, CTA = Y, 1 ronda incluida. Cambios fuera de esto son upgrade.

### 10.3 “Entrega”
> Listo. Tu landing está viva. Objetivo: X. Prueba: CTA + flujo. En 7 días te mandamos un reporte breve con la señal y el upgrade recomendado.

---

## 11) Riesgos operativos y mitigación (realidad)

- **Cliente no entrega activos** → Assisted Intake + no corre SLA.
- **Cliente cambia de idea** → scope freeze + upsell.
- **Integración externa falla** → fallback WA/tel; no se bloquea entrega.
- **“Quiero todo”** → mover a Discovery + SOW.

---

## 12) Appendix: “Express” como motor de cashflow

Landing Express existe para:
1) generar cash rápido (ventas repetibles),
2) recolectar señal real (eventos + conversion),
3) convertir clientes en upgrades (módulos).

**Si Express no puede producirse en 72h sin estrés, el sistema está mal diseñado.**

---
