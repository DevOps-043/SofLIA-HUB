# PRD Tecnico Implementable
## SofLIA Meeting Ops v1

Estado: Listo para implementacion
Tipo: PRD tecnico + plan de ejecucion
Objetivo: transformar artifacts de reunion ya existentes en activos operativos auditables, revisables y sincronizables con Project Hub, funcionando desde WhatsApp y desde la aplicacion de escritorio.

---

## 1. Resumen ejecutivo

SofLIA Meeting Ops v1 es el primer workflow transversal de SofLIA Hub.
Su funcion es tomar evidencia ya existente de una reunion, estructurarla, pedir revision humana cuando corresponda, y convertirla en acciones operativas seguras.

El workflow debe poder iniciar, continuar y cerrarse desde dos canales:

- WhatsApp
- Aplicacion Electron

El dominio de negocio debe vivir una sola vez en main process.
WhatsApp y la app solo seran adaptadores de entrada y salida.

---

## 2. Restricciones no negociables

### 2.1 Limite funcional del producto

SofLIA no graba, no escucha y no transcribe reuniones como sistema primario.
Meeting Ops comienza solo cuando ya existe al menos un artifact fuente autorizado.

Esto incluye, por ejemplo:

- transcript de Google Meet ya generado
- notas automaticas ya existentes
- resumen autorizado
- minuta manual aprobada
- agenda o documento fuente vinculado
- export de chat de reunion

No incluye:

- grabacion de audio
- escucha en vivo
- speech-to-text primario
- subtitulado en tiempo real
- bots de captura en la llamada

### 2.2 Restriccion arquitectonica

La logica del workflow no debe quedar repartida entre:

- `whatsapp-agent.ts`
- `preload.ts`
- componentes React
- wrappers renderer

La logica de negocio debe vivir en un modulo de dominio compartido en main process.

### 2.3 Restriccion de seguridad

Ninguna mutacion hacia Project Hub se ejecuta automaticamente sin aprobacion humana.

### 2.4 Restriccion de implementacion v1

Meeting Ops v1 no debe depender de `src/services/workspace-sources.ts`, porque hoy es un stub y no es una base confiable para este workflow.

---

## 3. Problema que resuelve

Hoy los artifacts de reunion pueden existir, pero no aterrizan en operacion real.

Los problemas observables son:

- quedan como texto plano sin estructura util
- no distinguen decision, compromiso, riesgo y pregunta abierta
- no se convierten de forma segura en trabajo ejecutable
- no sostienen continuidad entre sesiones
- no generan seguimiento consistente

Resultado: hay evidencia, pero no hay sistema operativo de la reunion.

Meeting Ops v1 cierra ese hueco.

---

## 4. Resultado esperado en v1

Meeting Ops v1 debe entregar:

1. Ingestion de un artifact fuente valido.
2. Normalizacion y versionado del contenido fuente.
3. Generacion de un `meeting_asset.v1`.
4. Revision humana del asset y de las acciones propuestas.
5. Sincronizacion controlada hacia Project Hub.
6. Continuidad minima y recordatorios basicos.

---

## 5. Realidad actual del repo

Este PRD queda alineado al codigo verificado del proyecto, no a componentes supuestos.

### 5.1 Componentes existentes que si podemos reutilizar

- [electron/main.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/electron/main.ts): bootstrap y registro de handlers
- [electron/drive-service.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/electron/drive-service.ts): busqueda, descarga y export de archivos desde Drive
- [electron/drive-handlers.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/electron/drive-handlers.ts): IPC de Drive
- [electron/calendar-service.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/electron/calendar-service.ts): OAuth Google y acceso a eventos
- [electron/iris-data-main.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/electron/iris-data-main.ts): acceso main-process a equipos, proyectos e issues de IRIS
- [electron/proactive-service.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/electron/proactive-service.ts): motor de recordatorios por polling
- [electron/memory-service.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/electron/memory-service.ts): continuidad contextual
- [electron/whatsapp-agent.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/electron/whatsapp-agent.ts): entrada conversacional de WhatsApp
- [electron/whatsapp-workflow-presentacion.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/electron/whatsapp-workflow-presentacion.ts): ejemplo de workflow actual por WhatsApp
- [electron/preload.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/electron/preload.ts): exponer namespaces IPC
- [src/services/drive-service.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/src/services/drive-service.ts): wrapper renderer de Drive

### 5.2 Componentes que el PRD anterior daba por existentes, pero no estan implementados en el repo actual

No se debe asumir existencia de:

- `workflow-engine.ts`
- `workflow-ai-service.ts`
- `workflow-handlers.ts`
- `drive-transcript-watcher.ts`
- cliente Bridge API de Project Hub

Si se necesitan, hay que crearlos explicitamente o redirigir la solucion a modulos reales ya existentes.

### 5.3 Restriccion importante para el canal app

[src/services/workspace-sources.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/src/services/workspace-sources.ts) sigue siendo un stub.
Por lo tanto, Meeting Ops v1 no debe apoyarse en esa capa para intake.

---

## 6. Principios de diseno

1. Un solo dominio, dos adaptadores.
2. Sin artifact fuente valido, no nace `meeting_run`.
3. El workflow no escribe directo a IRIS desde WhatsApp ni desde renderer.
4. Todo sync pasa por una cola de acciones aprobables.
5. Decision, compromiso, issue y pregunta abierta son entidades distintas.
6. Si falta owner, fecha o evidencia, se bloquea el sync.
7. Idempotencia y trazabilidad son obligatorias.
8. V1 optimiza confiabilidad y claridad, no sofisticacion prematura.

---

## 7. Arquitectura objetivo

## 7.1 Modelo de alto nivel

```text
Artifact fuente existente
  -> MeetingSourceService
  -> MeetingWorkflowService
  -> MeetingAIService
  -> meeting_asset.v1
  -> Review / Approval
  -> MeetingSyncService
  -> IRIS / Project Hub
  -> ProactiveService + MemoryService
```

## 7.2 Regla central

`MeetingWorkflowService` sera la unica autoridad de negocio del workflow.

### 7.2.1 Lo que si hace

- crea runs
- cambia estados
- valida reglas
- pide extraccion IA
- registra flags
- genera acciones sincronizables
- aprueba o rechaza acciones
- dispara sync
- expone estado comun a WhatsApp y app

### 7.2.2 Lo que no hace

- OAuth Google
- busqueda directa en UI
- composicion de mensajes de WhatsApp
- render de vistas React
- acceso directo desde renderer a IRIS

---

## 8. Modulos nuevos obligatorios

Para preservar modularizacion y pureza de codigo, Meeting Ops v1 se implementa en un modulo aislado.

### 8.1 Main process: dominio e infraestructura

Crear carpeta:

- `electron/meetings/`

Archivos propuestos:

1. `electron/meetings/meeting-types.ts`
   Responsabilidad: tipos, enums, DTOs y contratos del dominio.

2. `electron/meetings/meeting-store.ts`
   Responsabilidad: persistencia de runs, assets, fuentes, aprobaciones y sync actions.

3. `electron/meetings/meeting-source-service.ts`
   Responsabilidad: validar fuente, descargar/exportar, normalizar texto, calcular hash, versionar artifact.

4. `electron/meetings/meeting-ai-service.ts`
   Responsabilidad: invocar Gemini y producir `meeting_asset.v1`.

5. `electron/meetings/meeting-review-service.ts`
   Responsabilidad: validar ambiguedades, generar `review_flags`, construir propuestas de sync.

6. `electron/meetings/meeting-sync-service.ts`
   Responsabilidad: materializar acciones aprobadas usando un puerto de sync.

7. `electron/meetings/meeting-memory-service.ts`
   Responsabilidad: enviar solo hechos estables y continuidad relevante a `memory-service.ts`.

8. `electron/meetings/meeting-followup-provider.ts`
   Responsabilidad: exponer compromisos abiertos a `proactive-service.ts`.

9. `electron/meetings/meeting-workflow-service.ts`
   Responsabilidad: orquestador del dominio; unica entrada de negocio.

10. `electron/meeting-handlers.ts`
    Responsabilidad: registrar IPC `meeting:*`.

### 8.2 App adapter

Archivos propuestos:

1. `src/services/meeting-service.ts`
   Wrapper typed de `window.meeting`.

2. `src/components/meetings/MeetingOpsPanel.tsx`
   Intake, lista de runs y acceso a detalle.

3. `src/components/meetings/MeetingReviewPanel.tsx`
   Revision del asset y aprobacion de acciones.

4. `src/components/meetings/MeetingRunStatus.tsx`
   Estado, errores, sync y seguimiento.

### 8.3 WhatsApp adapter

Archivos propuestos:

1. `electron/whatsapp-workflow-meetings.ts`
   Adapter conversacional de WhatsApp para el workflow.

2. Cambios minimos en [electron/whatsapp-agent.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/electron/whatsapp-agent.ts)
   Solo para enrutar al adapter, no para mover logica de negocio ahi.

3. Cambios minimos en [electron/whatsapp-tools.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/electron/whatsapp-tools.ts)
   Solo si se agregan herramientas de consulta o aprobacion.

---

## 9. Fronteras de responsabilidad

### 9.1 Main process

Responsable de:

- estado del workflow
- persistencia
- IA estructurada
- reglas de negocio
- aprobaciones
- sync

### 9.2 Preload

Responsable solo de:

- exponer `window.meeting`
- validar que el canal este allowlisted

Prohibido:

- reglas de negocio
- transformaciones de dominio

### 9.3 Renderer

Responsable solo de:

- UI
- consumo de servicios
- render de listas, detalles y aprobaciones

Prohibido:

- escribir directo a Supabase IRIS para Meeting Ops
- reimplementar reglas del workflow

### 9.4 WhatsApp adapter

Responsable solo de:

- guiar al usuario
- pedir datos faltantes
- mostrar estado y resultados
- llamar al servicio de dominio

Prohibido:

- crear tareas directamente
- mutar estado sin pasar por `MeetingWorkflowService`

---

## 10. Estrategia de sync a Project Hub

## 10.1 Decision de arquitectura para v1

V1 no debe depender de un cliente Bridge API inexistente en este repo.

La estrategia correcta es:

1. Definir un puerto de dominio:
   - `MeetingProjectSyncPort`
2. Implementar por defecto:
   - `MeetingIrisDirectSyncAdapter`
3. Ese adapter usara funciones existentes de [electron/iris-data-main.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/electron/iris-data-main.ts)
4. Si despues se construye un cliente Bridge API real, se agrega:
   - `MeetingBridgeSyncAdapter`
5. El dominio no cambia.

## 10.2 Soporte de mutaciones por fase

### Fase 1

- crear tarea en proyecto/equipo existente

### Fase 2

- actualizar estado de tarea existente
- actualizar estado de proyecto existente

### Fase 3

- create_milestone
- create_cycle
- Bridge API adapter opcional

## 10.3 Regla de seguridad

El adapter de sync nunca es llamado directamente desde WhatsApp ni desde renderer.
Siempre pasa por:

- `meeting_sync_actions`
- aprobacion
- `MeetingSyncService`

---

## 11. Fuentes de entrada validas

## 11.1 Tipos aceptados en v1

Para mantener implementacion realista sin nuevas dependencias obligatorias, v1 acepta:

- Google Docs descargado/exportado a texto desde Drive
- archivo `.txt`
- archivo `.md`
- minuta pegada manualmente como texto
- transcript o notas pegadas en WhatsApp o en la app
- archivo de Drive cuyo contenido pueda exportarse a texto via `drive-service.ts`

## 11.2 Tipos opcionales, solo si se agregan parsers

- PDF
- DOCX

Si estos tipos se vuelven obligatorios, deben entrar como dependencia explicita y anexo tecnico.

## 11.3 Campos minimos de un source artifact

- `source_system`
- `source_type`
- `source_uri` o referencia equivalente
- `source_created_at`
- `source_version`
- `authority_level`
- `content_hash`
- `normalized_text`

## 11.4 Regla de nacimiento del run

`meeting_run` solo existe despues de que el source artifact fue validado e importado.

No existira estado persistido `SOURCE_PENDING`.
Si el usuario inicia una conversacion sin artifact, eso es una sesion de intake, no un `meeting_run`.

---

## 12. Flujos por canal

## 12.1 Flujo WhatsApp v1

Inicio recomendado:

- comando `/reunion`

Secuencia:

1. SofLIA pregunta el origen:
   - Drive
   - archivo reenviado
   - texto pegado
2. El adapter obtiene o arma el artifact.
3. `MeetingWorkflowService` valida y crea `meeting_run`.
4. `MeetingAIService` genera `meeting_asset.v1`.
5. WhatsApp devuelve:
   - resumen ejecutivo
   - compromisos detectados
   - flags de revision
6. El usuario aprueba o rechaza:
   - el asset
   - acciones propuestas
7. Si aprueba, `MeetingSyncService` sincroniza.
8. WhatsApp reporta resultado final.

## 12.2 Flujo App v1

Secuencia:

1. Usuario entra a "Meeting Ops".
2. Crea run desde:
   - seleccionar archivo de Drive
   - subir `.txt` o `.md`
   - pegar minuta
3. La app muestra el detalle del run.
4. El usuario revisa:
   - decisiones
   - compromisos
   - acciones propuestas
   - review flags
5. Aprueba o rechaza.
6. Lanza sync.
7. Visualiza estado, auditoria y pendientes.

## 12.3 Regla transversal

El mismo run debe poder consultarse desde ambos canales si el usuario autenticado coincide y pertenece a la misma organizacion/workspace.

---

## 13. Estados del workflow

### 13.1 Estados principales de `meeting_run`

- `SOURCE_IMPORTED`
- `EXTRACTING`
- `REVIEW_REQUIRED`
- `APPROVED`
- `SYNCING`
- `SYNCED`
- `FOLLOWUP_ACTIVE`
- `CLOSED`

### 13.2 Estados de excepcion

- `FAILED_IMPORT`
- `FAILED_EXTRACTION`
- `BLOCKED_REVIEW`
- `SYNC_FAILED`

### 13.3 Estados de `meeting_sync_action`

- `draft`
- `approved`
- `rejected`
- `synced`
- `failed`

---

## 14. Modelo de datos v1

Este diseno deja de asumir tablas genericas no verificadas.
V1 define un esquema minimo y explicito.

## 14.1 Tabla `meeting_runs`

Proposito: contenedor principal del workflow.

Campos minimos:

- `id uuid primary key`
- `organization_id text not null`
- `workspace_id text null`
- `owner_user_id text not null`
- `origin_channel text not null`
- `origin_ref text null`
- `meeting_title text null`
- `meeting_type text not null`
- `meeting_series_key text null`
- `status text not null`
- `source_hash text not null`
- `source_version integer not null`
- `trace_id uuid not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Indices/constraints:

- unique(`owner_user_id`, `source_hash`, `source_version`)
- index(`meeting_series_key`)
- index(`status`)

## 14.2 Tabla `meeting_source_artifacts`

Proposito: evidencia fuente y su version normalizada.

Campos minimos:

- `id uuid primary key`
- `meeting_run_id uuid not null`
- `source_system text not null`
- `source_type text not null`
- `source_uri text null`
- `external_file_id text null`
- `mime_type text null`
- `authority_level text not null`
- `sha256 text not null`
- `normalized_text text not null`
- `metadata jsonb not null default '{}'`
- `created_at timestamptz not null`

## 14.3 Tabla `meeting_assets`

Proposito: asset semantico versionado.

Campos minimos:

- `id uuid primary key`
- `meeting_run_id uuid not null`
- `schema_version text not null`
- `asset_version integer not null`
- `payload jsonb not null`
- `executive_summary text not null`
- `operational_summary text not null`
- `review_flags jsonb not null default '[]'`
- `confidence numeric null`
- `created_at timestamptz not null`

Constraint:

- unique(`meeting_run_id`, `asset_version`)

## 14.4 Tabla `meeting_sync_actions`

Proposito: cola de mutaciones aprobables.

Campos minimos:

- `id uuid primary key`
- `meeting_run_id uuid not null`
- `meeting_asset_id uuid not null`
- `action_type text not null`
- `target_type text not null`
- `payload jsonb not null`
- `approval_state text not null`
- `sync_state text not null`
- `sync_target text not null`
- `idempotency_key text not null`
- `external_ref text null`
- `error_message text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Constraint:

- unique(`idempotency_key`)

## 14.5 Tabla `meeting_approvals`

Proposito: auditoria de decisiones humanas.

Campos minimos:

- `id uuid primary key`
- `meeting_run_id uuid not null`
- `scope text not null`
- `scope_ref_id uuid null`
- `requested_by_user_id text not null`
- `decided_by_user_id text null`
- `decision text not null`
- `comment text null`
- `created_at timestamptz not null`
- `decided_at timestamptz null`

---

## 15. JSON canonico `meeting_asset.v1`

```json
{
  "schema_version": "meeting_asset.v1",
  "meeting_run_id": "uuid",
  "trace_id": "uuid",
  "meeting_title": "string",
  "meeting_type": "operational_review",
  "source_refs": [],
  "participants": [],
  "decisions": [],
  "commitments": [],
  "issues": [],
  "open_questions": [],
  "parking_lot": [],
  "executive_summary": "",
  "operational_summary": "",
  "review_flags": [],
  "proposed_actions": [],
  "continuity_context": []
}
```

### 15.1 Entidades minimas

#### `decision`

- `statement`
- `owner_candidate`
- `approval_state`
- `evidence_refs`
- `confidence`

#### `commitment`

- `statement`
- `owner_candidate`
- `due_date_candidate`
- `status`
- `project_target`
- `evidence_refs`
- `confidence`

#### `issue`

- `statement`
- `severity`
- `owner_candidate`
- `evidence_refs`
- `confidence`

#### `proposed_action`

- `action_type`
- `target_type`
- `summary`
- `payload`
- `requires_approval`
- `blocking_flags`

### 15.2 Flags minimos

- `missing_owner`
- `missing_due_date`
- `missing_evidence`
- `ambiguous_speaker`
- `missing_project_target`
- `low_confidence`

---

## 16. Reglas de negocio

1. Sin artifact fuente valido, no hay `meeting_run`.
2. Mismo hash y misma version no deben duplicar efectos.
3. Si cambia el contenido fuente, sube `source_version`.
4. Compromiso sin owner no se sincroniza.
5. Compromiso sin fecha no se sincroniza.
6. Accion sin proyecto o equipo destino no se sincroniza.
7. Identidad no confirmada no se usa para asignacion automatica.
8. Toda accion sincronizada conserva `trace_id` e `idempotency_key`.
9. Todo sync fallido debe ser reintentable sin duplicar efectos.
10. Solo los hechos estables pasan a memoria persistente de alto nivel.

---

## 17. Identity resolution v1

## 17.1 Objetivo

Resolver speakers y owners sin inventar identidades.

## 17.2 Fuente de matching

El matching se apoya en:

- `team_members`
- `account_users`
- contexto del usuario autenticado
- nombres y correos presentes en el artifact

## 17.3 Reglas

- match exacto y univoco: auto-resuelto
- multiples candidatos: requiere review
- sin candidato interno: `external_participant`
- assignee ambiguo: no sync automatico

---

## 18. Continuidad y seguimiento

## 18.1 Continuidad

Meeting Ops v1 debe cargar compromisos abiertos de sesiones previas usando `meeting_series_key` y apoyo de `memory-service.ts`.

## 18.2 Integracion con memoria

Solo enviar a memoria estable:

- decisiones vigentes
- compromisos abiertos relevantes
- riesgos persistentes
- relacion reunion-proyecto

No enviar:

- cada frase
- ruido conversacional
- afirmaciones sin evidencia

## 18.3 Integracion con proactividad

`ProactiveService` no debe duplicar logica del workflow.
Solo debe consultar un provider.

Se propone:

- `meeting-followup-provider.ts`

Senales v1:

- compromiso vence en menos de 48h
- compromiso vencido
- run aprobado pero no sincronizado
- proxima reunion con pendientes abiertos

---

## 19. Contratos IPC para la app

Agregar namespace `meeting:*` en:

- [electron/preload.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/electron/preload.ts)
- `ALLOWED_IPC_CHANNELS`

## 19.1 Canales minimos

- `meeting:create-run`
- `meeting:list-runs`
- `meeting:get-run`
- `meeting:create-run-from-drive`
- `meeting:create-run-from-upload`
- `meeting:create-run-from-text`
- `meeting:approve-asset`
- `meeting:approve-actions`
- `meeting:reject-action`
- `meeting:sync-approved-actions`
- `meeting:get-followups`

## 19.2 Regla

Todos los handlers devuelven:

```ts
{ success: boolean, error?: string, data?: unknown }
```

La UI nunca toca IRIS directamente para este workflow.

---

## 20. Contrato WhatsApp

## 20.1 Entrada recomendada

Comando inicial:

- `/reunion`

## 20.2 Sesion conversacional minima

El adapter debe soportar:

- intake del origen
- confirmacion del artifact
- revision del resumen
- aprobacion/rechazo
- sync
- consulta de estado

## 20.3 Regla de implementacion

El adapter de WhatsApp sera una capa delgada.
No debe reconstruir:

- reglas de estado
- validaciones
- payloads de sync
- logica de aprobacion

Todo eso sale de `MeetingWorkflowService`.

---

## 21. Google y dependencias manuales

Este apartado existe para que cualquier permiso o alta manual quede explicita y no enterrada en codigo.

## 21.1 Requisitos Google obligatorios para v1

Debes tener habilitados en Google Cloud:

- Google Drive API
- Google Calendar API
- Google OAuth consent screen

## 21.2 Requisitos opcionales

Solo si quieres correlacion adicional con Meet o metadata de espacios:

- Google Meet API

## 21.3 Redirect URI

Mantener autorizado:

- `http://localhost:8234/callback`

Esto coincide con [electron/calendar-service.ts](/C:/Users/fysg5/OneDrive/Escritorio/Pulse%20Hub/SofLIA%20-%20Hub/SofLIA-HUB/electron/calendar-service.ts#L50)

## 21.4 Variables de entorno obligatorias

- `VITE_GOOGLE_OAUTH_CLIENT_ID`
- `VITE_GOOGLE_OAUTH_CLIENT_SECRET`
- `VITE_GEMINI_API_KEY`
- `VITE_IRIS_SUPABASE_URL`
- `VITE_IRIS_SUPABASE_ANON_KEY`
- `VITE_SOFIA_SUPABASE_URL`
- `VITE_SOFIA_SUPABASE_ANON_KEY`

## 21.5 Scopes minimos recomendados para Meeting Ops v1

Para este workflow, el minimo funcional recomendado es:

- acceso de lectura a Drive
- metadata de Drive
- lectura de eventos de Calendar
- perfil basico del usuario

Si el bundle OAuth actual sigue pidiendo mas scopes por razones historicas, eso debe considerarse deuda tecnica separada y no una necesidad funcional de Meeting Ops v1.

## 21.6 Dependencias npm

### No obligatorias para fase 1

Meeting Ops v1 puede salir sin dependencias nuevas si limitamos intake a:

- Drive exportable a texto
- `.txt`
- `.md`
- texto pegado

### Opcionales solo si se expanden formatos

- `pdf-parse` para PDF
- `mammoth` para DOCX

Si se agregan, deben anotarse en el ticket correspondiente y entrar como decision explicita.

---

## 22. Criterios de aceptacion

### Canal y experiencia

- AC-01: desde WhatsApp se puede iniciar un run con un artifact valido
- AC-02: desde la app se puede iniciar un run con un artifact valido
- AC-03: el mismo run puede consultarse desde ambos canales por el mismo usuario autorizado

### Dominio

- AC-04: sin artifact valido no se crea `meeting_run`
- AC-05: se genera un `meeting_asset.v1` con decisiones, compromisos, issues y resumenes
- AC-06: compromisos ambiguos quedan con `review_flags`

### Sync y seguridad

- AC-07: ninguna accion se sincroniza sin aprobacion humana
- AC-08: acciones aprobadas se materializan una sola vez por `idempotency_key`
- AC-09: fallos de sync quedan registrados y son reintentables

### Continuidad

- AC-10: una reunion recurrente puede recuperar compromisos abiertos previos
- AC-11: compromisos proximos o vencidos aparecen via provider en recordatorios

### Perimetro

- AC-12: el sistema no intenta grabar ni transcribir reuniones

---

## 23. Riesgos y mitigaciones

### Riesgo 1: artifact fuente de baja calidad

Mitigacion:

- validar contenido minimo
- generar `low_confidence`
- bloquear sync automatico

### Riesgo 2: identity matching ambiguo

Mitigacion:

- resolver solo matches univocos
- mandar lo demas a revision

### Riesgo 3: duplicidad por reingesta

Mitigacion:

- hash del contenido
- `source_version`
- `idempotency_key`

### Riesgo 4: divergencia entre app y WhatsApp

Mitigacion:

- dominio unico en main process
- adapters delgados
- persistencia comun

### Riesgo 5: dependencia implicita de componentes incompletos

Mitigacion:

- no depender de `workspace-sources.ts`
- no depender de un Bridge client inexistente

---

## 24. Plan de implementacion por modulos

## Fase 0: Fundacion del dominio

### Ticket MOP-01 - Tipos y estados del workflow

Entregable:

- `meeting-types.ts`
- enums, DTOs y contratos

DoD:

- tipos compartidos sin duplicacion entre app y WhatsApp
- estados cerrados y documentados

### Ticket MOP-02 - Persistencia del workflow

Entregable:

- `meeting-store.ts`
- migraciones/tablas nuevas

DoD:

- create/read/update del run
- assets versionados
- acciones sincronizables y aprobaciones persistidas

### Ticket MOP-03 - Ingestion y normalizacion de fuentes

Entregable:

- `meeting-source-service.ts`

DoD:

- intake desde Drive
- intake desde upload `.txt` / `.md`
- intake desde texto pegado
- calculo de hash y version

## Fase 1: Extraccion y revision

### Ticket MOP-04 - Extraccion IA estructurada

Entregable:

- `meeting-ai-service.ts`
- schema `meeting_asset.v1`

DoD:

- salida JSON valida
- fallback seguro
- review flags basicos

### Ticket MOP-05 - Orquestador del workflow

Entregable:

- `meeting-workflow-service.ts`
- `meeting-review-service.ts`

DoD:

- run transita de `SOURCE_IMPORTED` a `REVIEW_REQUIRED`
- se generan acciones propuestas
- no hay logica duplicada en adapters

### Ticket MOP-06 - IPC y app UI

Entregable:

- `meeting-handlers.ts`
- `meeting:*` en preload
- `src/services/meeting-service.ts`
- paneles React

DoD:

- crear run desde la app
- revisar asset
- aprobar acciones
- ejecutar sync

### Ticket MOP-07 - Adapter WhatsApp

Entregable:

- `whatsapp-workflow-meetings.ts`

DoD:

- flujo guiado por WhatsApp
- consulta de estado
- aprobacion y sync
- sin logica de dominio incrustada en `whatsapp-agent.ts`

## Fase 2: Sync operativo

### Ticket MOP-08 - Puerto de sync y adapter IRIS directo

Entregable:

- `MeetingProjectSyncPort`
- `MeetingIrisDirectSyncAdapter`
- `meeting-sync-service.ts`

DoD:

- crea tareas en IRIS via adapter
- usa `idempotency_key`
- registra resultado y error

### Ticket MOP-09 - Aprobaciones y auditoria

Entregable:

- persistencia de decisiones humanas
- timeline de run

DoD:

- todo cambio critico queda trazado
- se sabe quien aprobo y cuando

## Fase 3: Continuidad y proactividad

### Ticket MOP-10 - Follow-up provider

Entregable:

- `meeting-followup-provider.ts`

DoD:

- `proactive-service.ts` puede consultar pendientes sin duplicar dominio

### Ticket MOP-11 - Integracion con memoria

Entregable:

- `meeting-memory-service.ts`

DoD:

- solo hechos estables viajan a memoria de largo plazo

---

## 25. Definition of Done global

Meeting Ops v1 se considera terminado solo si cumple todo esto:

1. Hay un unico dominio compartido para app y WhatsApp.
2. La logica del workflow no esta repartida en adapters o UI.
3. El workflow nace solo con artifact valido.
4. Las aprobaciones son persistentes y auditables.
5. El sync es idempotente.
6. Los cambios no dependen de `workspace-sources.ts`.
7. El flujo funciona desde WhatsApp y desde la app.
8. Los permisos Google y pasos manuales estan documentados.

---

## 26. Decision final de producto para v1

Meeting Ops v1 no intenta ser un motor universal de governance de reuniones.
Su primera responsabilidad es mucho mas concreta:

- recibir evidencia existente
- estructurarla
- validarla
- convertirla en acciones seguras
- sostener continuidad real

Eso deja una base limpia, modular y mantenible para futuras fases sin mezclar logica en archivos ajenos ni romper el sistema cuando otro desarrollador u otra IA toque el codigo.
