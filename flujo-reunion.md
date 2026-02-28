A continuación te dejo el diseño **end-to-end** (proceso + propuesta de producto) para que **SofLIA** soporte flujos **operativos, comerciales y de marketing** con **aprobaciones HITL**, trazabilidad y gobernanza auditable.

---

## 0) As-Is mínimo (con evidencia) — SofLIA hoy

**Hecho (con evidencia)**

- Existe **SofLIA Hub (desktop)** con **agente por WhatsApp**, capacidades multimodales y **escritura/actualización en IRIS (Project Hub)** para proyectos/tareas, además de controles de seguridad en grupos.
- Existe **SofLIA Extension (Chrome)** con: chat, **Meeting transcription en Google Meet**, **Web Agent** (control del navegador), **IRIS Project Hub**, y una **Tool Library** con generadores de documentos/diagramas.
- En el ecosistema ya se usa un patrón **pipeline por fases con estados + HITL** (aprobación manual entre pasos) en CourseForge.
- La arquitectura declara regla operativa: **“NO webhooks, usar endpoints REST”** (esto impacta diseño de integraciones).

**Supuesto (As-Is mínimo donde falta dato)**

- **[Supuesto]** No existe aún un **Workflow Engine genérico** (BPM ligero) reutilizable para procesos comerciales/marketing con aprobaciones por paso (más allá de pipelines específicos tipo CourseForge).
- **[Falta dato]** Stack actual de **CRM/Correo/Calendario/WhatsApp Business API** para ejecución automática (más allá de WhatsApp vía Hub).

---

# 1) Capacidades requeridas (lista clara y verificable)

### 1.1 Orquestación de workflows (BPM ligero)

- Triggers: manual, formulario, QR, nota/voz WhatsApp, transcript Meet, import CSV.
- State machine por proceso: estados, transiciones, guards (reglas), timers.
- SLA por paso + escalaciones + delegación + “re-aprobación” cuando cambian datos.
- Idempotencia (no duplicar acciones), reintentos, y reconciliación.

### 1.2 Aprobaciones HITL por paso

- Acciones: **aprobar / editar / rechazar / iterar / solicitar más contexto**.
- “Diff” entre output IA vs edición humana; motivo de cambio; checklist de calidad.
- Soporte multi-aprobador (1 o 2-person rule), umbrales y “break-glass” controlado.

### 1.3 Generación asistida por IA (artefactos)

- Resumen de conversación, extracción de entidades, next steps.
- Emails, WhatsApp, propuesta/SOW breve, agenda de siguiente reunión.
- Brief marketing, one-pager, secuencia de seguimiento, copy para post/brochure.
- QA automático (consistencia, tono, claims, datos faltantes) + bandera de riesgo.

### 1.4 Integración con CRM / correo / calendario / WhatsApp (genérico)

- Conectores “pluggable”: CRM (cualquiera), correo (cualquiera), calendario (cualquiera), mensajería (WhatsApp).
- Modo degradado: export CSV + borradores + copiar/pegar + tareas IRIS cuando no hay API.

### 1.5 Bitácora auditable (ledger)

- Quién aprobó qué, cuándo, por qué, con qué evidencia, versión, y qué acción se ejecutó.
- Correlación por `trace_id` a través de: interacción → generación → aprobación → ejecución.

### 1.6 Monitoreo y optimización

- Embudo (MQL/SQL/Opp), tiempos por paso, retrabajo, % aprobaciones sin edición.
- Cumplimiento SLA, cuellos de botella, calidad (proxy) y conversión por etapa.

### 1.7 Missing but likely necessary (recomendado)

- Biblioteca de plantillas + variables + versionado de plantillas.
- Brand voice por organización y “policy guardrails” (promesas comerciales, legal claims).
- Consentimiento/privacidad (LFPDPPP): base legal, minimización de datos, retención.
- Deduplicación (contactos/empresas), scoring calibrable, repositorio de activos marketing.
- Controles anti-alucinación: grounding a evidencia interna + “no inventar datos” por default (patrón CourseForge).

---

# 2) Mapa As-Is vs To-Be (SofLIA)

### As-Is (con evidencia)

- **Captura**: WhatsApp multimodal (Hub) y Meet transcription (Extension).
- **Acción sobre trabajo**: creación/actualización de tareas/proyectos en IRIS.
- **Generación**: Tool Library con generadores; y pipelines HITL por fases (CourseForge).
- **Seguridad**: controles por contexto (p.ej., en grupos) + enfoque multi-tenant/RLS declarado.

### To-Be (lo que falta para tu caso obligatorio)

- **Core (MVP)**
  1. **Workflow Engine** reutilizable + estados + SLA + escalación.
  2. **Aprobaciones HITL** estandarizadas por paso (inbox, diff, versionado).
  3. **Modelo “Prospecto/Empresa/Oportunidad”** (CRM-lite interno) o integración con CRM real.
  4. **Ejecución controlada**: “sin aprobación no se ejecuta” en pasos críticos.
  5. **Ledger auditable** transversal (trace_id end-to-end).

- **Nice-to-have**
  - Scoring calibrable, A/B testing, secuencias multi-canal, repositorio de assets marketing, “playbooks” con aprendizaje automático.

### Dependencias y riesgos

- **Dependencia**: decisión de CRM (interno vs externo) y canal de correo/calendario. **[Falta dato]**
- **Riesgo**: si se automatiza envío sin guardrails → promesas comerciales/privacidad. Mitigación: pasos críticos con aprobación + policies.

---

# 3) Flujo detallado “Reunión → Prospecto → Seguimiento” (paso a paso)

> Diseño “auditable”: cada paso crea/actualiza entidades y registra `trace_id`.

## 3.1 Trigger de entrada (uno o varios)

- A) Nota/voz en WhatsApp al Hub (“/soflia registrar reunión con X”). **Hecho: WhatsApp agent existe.**
- B) Transcript de Google Meet desde la Extension. **Hecho: meeting transcription existe.**
- C) Formulario/QR (landing) **[Supuesto]**.

## 3.2 Extracción IA + pantalla HITL (normalización)

- IA propone: Empresa, contacto, rol, pains, objeciones, intención, presupuesto (si se dijo), siguiente paso.
- **HITL obligatorio**: tú apruebas/corriges campos antes de crear/actualizar registros.
- QA: si faltan datos críticos → “Solicitar más contexto” (no avanza).

## 3.3 Creación/actualización de Prospecto/Empresa/Oportunidad

- Opción 1: **CRM-lite SofLIA** (tablas internas) **[Supuesto]**.
- Opción 2: Conector CRM (Salesforce/HubSpot/Pipedrive/Zoho/etc.) **[Falta dato]**.
- **HITL obligatorio** antes de escribir en CRM si el match/dedupe es incierto.

## 3.4 Generación de piezas + aprobaciones por cada una

Para cada artefacto: IA v1 → (edición humana) v2 → aprobado v3.

a) **Correo de seguimiento** (borrador)
b) **Mensaje corto WhatsApp**
c) **Tareas internas y asignaciones** (ventas/marketing) → se crean como issues en IRIS (ya hay CRUD IRIS).
d) **Siguiente reunión**: agenda propuesta + (si hay integración) crear evento calendario **[Falta dato]**
e) **Brief de propuesta / alcance** (one-pager interno)
f) **Material marketing** (one-pager/brochure/post/secuencia)

## 3.5 Enrutamiento a equipo (ventas/marketing)

- Asignación de dueños, fechas, SLA y escalación.
- Notificaciones: Inbox SofLIA + (opcional) WhatsApp/IRIS notifications **[Falta dato]**.

## 3.6 Cierre del ciclo (ganado/perdido/siguiente paso)

- Actualizar etapa y motivo.
- Capturar “lecciones”: qué funcionó, qué no, qué template se ajusta.
- Actualizar playbook/plantilla (con versionado y evidencia).

---

# 4) Matriz de autorizaciones (Comercial y Marketing)

| Paso                    | Qué produce la IA                | Quién aprueba               | Criterios de aprobación                    | Acción al aprobar      | Acción al rechazar                | Evidencia requerida        |
| ----------------------- | -------------------------------- | --------------------------- | ------------------------------------------ | ---------------------- | --------------------------------- | -------------------------- |
| Resumen de conversación | Resumen + bullets + riesgos      | Owner comercial             | Fidelidad al transcript/nota; sin inventar | Guardar en Interacción | Volver a extraer / pedir contexto | Transcript/nota fuente     |
| Extracción de datos     | Empresa/contacto/needs/next step | Owner comercial             | Campos completos; sin ambigüedad           | Escribir CRM/CRM-lite  | “Solicitar más contexto”          | Fuente + confidencialidad  |
| Lead scoring sugerido   | Score + razón + señales          | Líder comercial             | Reglas transparentes; calibración          | Guardar score + tareas | Enviar a revisión/manual          | Señales citadas            |
| Email de seguimiento    | Email v1                         | Owner comercial             | Tono, CTA, promesa válida                  | Crear borrador/enviar  | Iterar con feedback               | Playbook + transcript      |
| WhatsApp corto          | Mensaje 1–2 líneas               | Owner comercial             | Breve, claro, consentimiento               | Enviar / dejar listo   | Editar/descartar                  | Opt-in / contexto          |
| Propuesta / alcance     | Outline + supuestos              | Director comercial/Delivery | Sin sobreprometer; alcance claro           | Crear doc + tarea      | Regenerar con límites             | Notas + catálogo servicios |
| Secuencia seguimiento   | Cadencia + mensajes              | RevOps                      | Consistencia con etapa                     | Programar / tareas     | Ajustar estrategia                | Reglas de cadencia         |
| Copy campaña/post       | Copy + hashtags + CTA            | Marketing lead              | Brand voice + claims                       | Publicación programada | Iterar                            | Brand book + políticas     |
| Mensaje interno equipo  | Brief a ventas/marketing         | Owner + PMO                 | Accionable, SLA                            | Crear tasks IRIS       | Re-trabajar                       | Dueños + fechas            |

---

# 5) Modelo auditable (mínimo de datos y trazabilidad)

### Entidades (sugeridas)

- **Prospecto**, **Empresa**, **Oportunidad**, **Interacción** (meeting/whatsapp/email)
- **WorkflowRun**, **WorkflowStepRun**
- **OutputIA** (artefacto generado)
- **Approval** (HITL)
- **Task** (IRIS issue o tarea interna)
- **Evidence** (links a transcript, audio, docs)
- **Metric** (KPIs por run/paso)

### Campos mínimos (por tabla)

- Identidad: `id`, `organization_id`, `created_at`, `updated_at`
- Trazabilidad: `trace_id`, `parent_trace_id`, `source_system`, `source_ref`
- Versionado: `version`, `template_version`, `model`, `prompt_hash`
- Responsables: `created_by`, `approved_by`, `assigned_to`, `role_at_time`
- Estado: `status` (state machine), `sla_due_at`, `escalated_at`
- Auditoría humana vs IA: `ai_output_raw`, `human_edit_diff`, `human_final`
- Motivos: `approval_decision`, `approval_reason`, `rejection_reason`
- Confidencialidad: `data_classification` (p.ej. Public/Interna/Confidencial/Sensible)
- Evidencia: `evidence_links[]` + checksum/metadata.

---

# 6) Modelo operativo del Workflow Engine (BPM ligero)

### 6.1 Tipos de proceso

- **Comercial**: Captura → Normaliza → Califica → Sigue → Propone → Cierra
- **Marketing**: Brief → Copy/Asset → Aprobación → Publicación/Entrega → Medición
- **Operativo**: Solicitud → Validación → Aprobación → Ejecución → Cierre

### 6.2 State machine (ejemplo por StepRun)

- `DRAFT` → `READY_FOR_REVIEW` → `CHANGES_REQUESTED` → `APPROVED` → `EXECUTED` → `DONE`
- Reglas:
  - Si cambia input crítico (p.ej. datos del prospecto) → `REAPPROVAL_REQUIRED` (invalidar ejecuciones pendientes).

### 6.3 SLA y escalaciones (ejemplos)

- Follow-up inicial: SLA 2h hábiles desde “Interacción registrada”.
- Propuesta breve: SLA 48h.
- Escalación: si `now > sla_due_at` → notificar líder + mover prioridad + “delegación sugerida”.

### 6.4 Excepciones

- Rechazos: guardan motivo + obligan iteración.
- Bypass “break-glass”: solo rol Director/Admin, requiere motivo + 2FA/2-person approval (según umbral).
- Reintentos: ejecución con backoff; **idempotency_key** por acción externa.
- Idempotencia: `(action_type, target_ref, idempotency_key)` único.

### 6.5 Roles/RBAC (segregación de funciones)

- **Solicitante**, **Aprobador**, **Operador**, **Auditor**, **Admin**
- Regla: quien ejecuta (Operador/Connector) no debe ser quien aprueba (Aprobador) en pasos críticos.

---

# 7) Integración de autorizaciones externas: “Wendis Apro” (investigar y definir)

## 7.1 Verificación (lo que sí pude confirmar)

**Hecho (con evidencia de investigación web):** no encontré evidencia pública clara de un producto llamado **“Wendis Apro”** asociado a aprobaciones/workflows; los resultados relevantes devuelven coincidencias no relacionadas (personas, PDFs legales u otros “Apro” distintos).

**Conclusión:** **[Falta dato]** nombre correcto, vendor, sitio oficial y documentación técnica.

## 7.2 Cómo validar sin inventar (checklist de verificación)

- Confirmar **nombre exacto** (captura de pantalla del sistema / contrato / factura / RFC del proveedor).
- Pedir al proveedor: **API docs**, método de auth (OAuth/API key), límites, exportaciones, SSO (SAML/OIDC).
- Confirmar si emite eventos (webhooks) y, si SofLIA mantiene “NO webhooks”, acordar alternativa por **polling REST**.

## 7.3 Si hay API (diseño mínimo)

- Objetos: `approval_request`, `approval_decision`, `user`, `attachment/evidence`, `status`.
- Eventos: `approval.created`, `approval.approved`, `approval.rejected`, `approval.escalated`.
- Auth: OAuth2 preferible; si API keys → rotación + vault + scopes.
- Resiliencia: rate limits, retries con backoff, idempotencia, y logging por `trace_id`.

## 7.4 Si NO hay API o sigue ambiguo: alternativas

a) **Conector por correo/CSV**: exportar solicitudes, importar decisiones; reconciliación diaria.
b) **RPA/Agentic con guardrails (UI)**: Web Agent opera UI, pero cada acción guarda evidencia (screenshot + DOM) y requiere aprobación humana antes/después. (SofLIA ya tiene Web Agent en Extension).
c) **Reemplazo funcional interno**: módulo de aprobaciones SofLIA (recomendado para MVP) con ledger, SLA, inbox.

## 7.5 Contrato de integración (entrada/salida)

- Entrantes: “approval required”, “decision made”.
- Salientes: “create approval”, “sync status”, “attach evidence”, “close loop”.
- Fallback: si falla sincronización → marcar `OUT_OF_SYNC` + tarea IRIS para reconciliar.

---

# 8) UX / Pantallas mínimas (producto)

1. **Bandeja de aprobaciones (Inbox)**

- Filtros: rol, prioridad, SLA, tipo (email/whatsapp/propuesta/copy).
- Acciones rápidas: aprobar, editar, pedir contexto, rechazar.

2. **Formulario dinámico de solicitud**

- Tipo de workflow (Comercial/Marketing/Operativo) → campos + evidencias requeridas.

3. **Vista de trazabilidad (Timeline)**

- Línea de tiempo por `trace_id`: input → outputs → diffs → aprobaciones → ejecuciones.

4. **Panel de métricas**

- Lead time, throughput, % rechazos, retrabajo, cuellos de botella.

5. **Centro de políticas**

- Pasos críticos, umbrales (doble aprobación), tono/brand voice, claims prohibidos.

---

# 9) Observabilidad + Seguridad + Compliance

**Hecho (contexto técnico):** SofLIA usa Supabase y patrones multi-tenant/RLS en su ecosistema (Extension/Project Hub).

### 9.1 Observabilidad

- Logs estructurados: `trace_id`, `workflow_run_id`, `step_run_id`, `actor_id`.
- Métricas: SLA breach rate, approval cycle time, execution error rate.
- Alertas: paso crítico vencido; anomalías (p.ej., demasiados rechazos por template).

### 9.2 Seguridad (mínimos)

- RBAC por organización/equipo + RLS en tablas sensibles.
- Segregación de funciones (aprobador ≠ ejecutor).
- Secret management para conectores (rotación, scopes).

### 9.3 Controles anti-errores (IA)

- “No inventar” por default: si falta evidencia → bloquear avance.
- QA automático: tono, datos faltantes, claims comerciales, PII innecesaria.
- “Citas internas”: cada output liga a evidencia (transcript/nota) y marca supuestos.

### 9.4 Retención y export

- Retención por tipo de dato (interacciones vs evidencias) + export auditoría (CSV/JSON).
- Niveles de confidencialidad y masking en vistas para roles no autorizados.

### 9.5 Anti-fraude

- Doble aprobación por umbral (p.ej. descuentos altos / promesas SLA / contratos).
- Detección de anomalías (IA): cambios humanos drásticos, patrones de bypass.

---

# 10) Reglas de gobernanza (no negociables)

1. **“Sin aprobación no se ejecuta”** en pasos críticos (mínimo):

- Envío de email/WhatsApp al prospecto
- Creación/actualización de oportunidad en CRM cuando hay dedupe incierto
- Envío de propuesta/alcance
- Publicación de material marketing (post/brochure/campaña)
- Cualquier “break-glass” o bypass

2. **Versionado de outputs**

- IA v1 → humano editado v2 → aprobado v3 (+ `prompt_hash`, `template_version`).

3. **Checklist mínimo de calidad por tipo**

- Email/WhatsApp: claridad + CTA + no prometer lo no acordado + privacidad.
- Propuesta: alcance/supuestos/exclusiones + próximos pasos + vigencia.
- Copy marketing: brand voice + claims permitidos + compliance.

4. **Permisos por rol**

- Vendedor: crea borradores, no ejecuta pasos críticos sin aprobación.
- Líder comercial: aprueba y autoriza ejecución.
- Marketing: aprueba piezas y publica.
- Auditor: solo lectura + export.
- Admin: configura políticas, no “edita evidencia”.

---

# 11) Backlog priorizado (MVP → Next)

### MVP (pilotos 2–4 semanas)

| Ítem                                                  | Valor | Esfuerzo | Dependencias | Riesgos      | Métrica de éxito                  |
| ----------------------------------------------------- | ----: | -------: | ------------ | ------------ | --------------------------------- |
| Workflow Engine mínimo (state machine + SLA)          |  Alto |        M | —            | Complejidad  | 90% runs sin error                |
| Inbox HITL + diff + versionado                        |  Alto |        M | —            | UX           | 70% aprobaciones < 4h             |
| CRM-lite (Prospecto/Empresa/Opp)                      |  Alto |        M | —            | Scope creep  | 0 duplicados críticos en piloto   |
| Generadores: resumen + email + WhatsApp + tareas IRIS |  Alto |        M | IRIS CRUD    | Calidad      | 60% outputs aprobados sin edición |
| Ledger auditable (trace_id end-to-end)                |  Alto |        M | —            | Modelo datos | 100% pasos con evidencia          |
| Policies básicas (pasos críticos + claims)            |  Alto |        S | —            | Adopción     | 0 envíos sin aprobación           |

### Next (6–12 semanas)

- Conectores reales (CRM/correo/calendario/WhatsApp Business) **[Falta dato stack]**
- Scoring calibrable + explicable + dashboards por cohorte.
- Secuencias multicanal + A/B testing.
- Playbooks versionados + aprendizaje desde “lecciones” (qué template convierte más).
- Repositorio de assets marketing + approvals por campaña.

---

# 12) Métricas y KPIs

**Comercial/Marketing**

- Tiempo a primer follow-up (p50/p90)
- Tasa de respuesta, tasa de reunión agendada, conversión por etapa, velocidad de pipeline
- % oportunidades con “next step” definido (calidad de captura)

**Operación / HITL**

- % outputs aprobados sin edición
- Retrabajo: promedio de iteraciones por artefacto
- SLA compliance por paso (on-time %)
- Tiempo humano invertido por run (proxy de eficiencia)
- Adopción: # workflows/usuario/semana

---

# 13) Preguntas para cerrar huecos (máx. 10)

1. ¿Cuál es el **CRM** objetivo (o confirmamos CRM-lite interno para MVP)? **[Bloquea integración]**
2. ¿Cuál canal de **correo** se usará para envío (Google/Microsoft/otro)? **[Bloquea ejecución]**
3. ¿Calendario (Google/Microsoft) para crear la siguiente reunión está disponible para este flujo o solo sugerimos agenda?
4. ¿WhatsApp es solo vía Hub (Baileys) o habrá **WhatsApp Business API** oficial?
5. ¿Qué campos son **obligatorios** para “Prospecto/Oportunidad” en tu operación (mínimo viable)?
6. ¿Lista de **claims/prohibiciones** comerciales (descuentos, SLA, garantías) por política?
7. Niveles de **confidencialidad** y retención (p.ej. cuánto guardar audios/transcripts).
8. ¿Quiénes serán roles reales: vendedor, líder comercial, marketing, auditor (nombres/puestos)?
9. ¿Definición de “pasos críticos” adicional (p.ej. enviar pricing, contratos, NDA)?
10. ¿Qué es exactamente **“Wendis Apro”** (captura/URL/contrato) para identificar vendor y capacidades?

---

## Resumen ejecutivo (8–12 líneas)

SofLIA ya tiene piezas clave para el caso “Reunión → Prospecto → Seguimiento”: captura por WhatsApp (Hub), transcript de Meet (Extension), generación de artefactos y escritura de tareas en IRIS, además de patrones HITL por fases (CourseForge).
Para soportar flujos comerciales/marketing **auditables**, falta consolidar un **Workflow Engine** reutilizable con state machine, SLA y escalación; un **Inbox HITL** con diff/versionado; un **ledger** end-to-end con `trace_id`; y un modelo CRM-lite o conectores a CRM/correo/calendario.
La regla “sin aprobación no se ejecuta” debe aplicarse a envíos externos, propuestas, publicaciones y bypass, con policies y segregación de funciones.
“Wendis Apro” no es verificable públicamente con el nombre dado; se propone validación interna (vendor/docs) y, mientras tanto, alternativas (CSV/correo, RPA con evidencia o módulo interno).
