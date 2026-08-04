# Arquitectura de datos

Estado: vigente. Actualizado: 2026-08-04.

<!-- evidence: database/README.md -->
<!-- evidence: src/config.ts -->
<!-- evidence: electron/memory/schema.ts -->

## Autoridades remotas

| Instancia | Configuracion | Autoridad | Acceso desde renderer | Acceso desde main |
|---|---|---|---|---|
| SOFIA Learning | `VITE_SOFIA_SUPABASE_URL/ANON_KEY` | auth, usuarios, organizaciones, membresias, equipos y plataforma learning | `src/lib/sofia-client.ts`, contexto auth | servicios Learning especificos |
| Lia / Hub | `VITE_SUPABASE_URL/ANON_KEY` | conversaciones, carpetas, settings, monitoreo, meetings, SDO, shares, fuentes y estado Hub | `src/lib/supabase.ts`, services | stores de meetings/SDO y servicios operativos |
| IRIS | `VITE_IRIS_SUPABASE_URL/ANON_KEY` | equipos/proyectos/issues, members, estados y prioridades | `src/lib/iris-client.ts`, `src/services/iris-data/` | `electron/iris/` para tools/sync |

No se permiten joins SQL entre proyectos Supabase. Los enlaces cruzados son IDs
de texto/UUID en la aplicacion: organizacion/equipo SOFIA delimitan consultas IRIS;
meeting sync crea referencias externas; SDO guarda `origin_ref`/`external_ref`.

## Persistencia local

| Almacen | Ubicacion efectiva | Contenido | Retencion implementada |
|---|---|---|---|
| Memoria SQLite | `userData/soflia-memory.db` | messages, summaries, memory_chunks, facts, skills | compactacion explicita; sin politica temporal global documentada |
| Pensamientos SQLite | `userData/thoughts.db` (fallback cwd standalone) | `event_stream` por agente/tarea | sin retencion automatica visible |
| Indice FTS5 | `~/.sofia-semantic-indexer.db` | filepath, filename, content | reindex reemplaza contenido; daemon configurable |
| Knowledge Markdown | `userData/knowledge/` | `MEMORY.md`, `users/`, `memory/`, `PATHS.md` | escrituras/reescritura explicitas |
| Config JSON | `userData/*.json` | desktop, proactive, scheduler, canales, workflow, tools | overwrite atomico no garantizado en todos los servicios |
| Credenciales WhatsApp | directorio auth del servicio | sesion Baileys | persiste para auto-connect hasta desconectar/eliminar |
| Screenshots | directorio monitoring en `userData` | capturas habilitadas | cleanup por edad invocable; transitorias se borran si no se guardan |

## Flujos de consistencia

### Identidad

1. Auth SOFIA obtiene usuario y memberships.
2. Una función Lia valida el JWT SOFIA y la membresía activa, y emite un token
   Lia de un solo uso para el correo verificado; ninguna contraseña cruza entre
   proyectos.
3. El renderer canjea el token por una sesión Lia ordinaria; el usuario Lia
   existente conserva su UUID y RLS.
4. `dataUserId` se usa para tablas Lia; `user.id` y aliases se consideran en
   access lists durante migracion.
5. Cambio de organizacion recalcula equipos y scope IRIS.

### Chat

El renderer mantiene pending state y cache para soportar escrituras parciales. La
fuente remota Lia sigue siendo autoridad; recovery purga/replica pendientes y
normaliza conversaciones/mensajes. Borrar una conversacion debe respetar shares y
politicas RLS, no solo remover cache.

### Meetings/SDO

- `meeting_runs.trace_id` es unico; owner+source_hash+version evita duplicados.
- FKs de source/assets/sync/approvals usan cascade desde run; detection usa
  `SET NULL` para conservar candidato.
- `meeting_sync_actions.idempotency_key` evita duplicar efectos externos.
- SDO separa estado epistemico, de autoridad y temporal; `confidence` mide
  extraccion, no verdad.
- `sdo_approvals.decided_by_user_id` es obligatorio y humano por regla de servicio.
- `sdo_audit_events` bloquea UPDATE/DELETE mediante trigger.

## RLS y riesgo efectivo

El estado no es uniforme:

- tablas de monitoreo declaran `auth.uid() = user_id`;
- meeting, SDO y `hub_service_state` tienen RLS habilitado pero politicas
  permisivas para `anon, authenticated` porque main usa anon key sin sesion;
- por tanto el aislamiento de esas tablas depende hoy de filtros/validacion de
  aplicacion, no de una barrera tenant fuerte en Postgres.

Esto es un riesgo conocido expresamente comentado como migracion pendiente en los
SQL. No debe afirmarse que RLS protege por owner esas tablas. Endurecer requiere
propagar sesion/JWT confiable a main o una API backend y migrar politicas sin
bloquear el Hub.

## Migraciones y snapshots

- `database/<instancia>/migrations/`: SQL ejecutable revisable.
- `database/<instancia>/snapshots/schema.sql`: inventario informativo; no ejecutar.
- `database/shared/`: auditorias o cambios que abarcan varias instancias.
- Meeting Ops debe existir en Lia; `database/iris/migrations/drop-meeting-ops.sql`
  corrige una ubicacion historica equivocada.
- Una migracion debe declarar instancia, preflight, constraints/indices/RLS,
  verificacion y rollback segun `docs/standards/database.md`.

## Respaldo y restauracion

Supabase gestiona backup remoto fuera de este repo. Localmente no existe job de
backup integral versionado. `hub_service_state` espeja ciertos estados JSON a Lia,
pero no cubre memoria SQLite, knowledge, credenciales, screenshots ni todos los
settings. La estrategia operativa y sus limites se detalla en
[release y recuperacion](../operations/release-and-recovery.md).
