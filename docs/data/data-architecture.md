# Arquitectura de datos

Estado: vigente. Actualizado: 2026-08-04.

<!-- evidence: database/README.md -->
<!-- evidence: src/config.ts -->
<!-- evidence: electron/memory/schema.ts -->

## Autoridades remotas

| Instancia | Configuracion | Autoridad | Acceso desde renderer | Acceso desde main |
|---|---|---|---|---|
| SOFIA Learning | `VITE_SOFIA_SUPABASE_URL/ANON_KEY` | auth, usuarios, organizaciones, membresias, equipos y plataforma learning | `src/lib/sofia-client.ts`, contexto auth | servicios Learning especificos |
| Lia / Hub | `VITE_SUPABASE_URL/ANON_KEY` | conversaciones, carpetas, settings, monitoreo, meetings, shares, fuentes y estado Hub | `src/lib/supabase.ts`, services | stores de meetings y servicios operativos |
| IRIS | `VITE_IRIS_SUPABASE_URL/ANON_KEY` | equipos/proyectos/issues, members, estados y prioridades | `src/lib/iris-client.ts`, `src/services/iris-data/` | `electron/iris/` para tools/sync |

No se permiten joins SQL entre proyectos Supabase. Los enlaces cruzados son IDs
de texto/UUID en la aplicacion: organizacion/equipo SOFIA delimitan consultas IRIS;
meeting sync crea referencias externas mediante `external_ref`.

## Persistencia local

| Almacen | Ubicacion efectiva | Contenido | Retencion implementada |
|---|---|---|---|
| Memoria SQLite | `userData/soflia-memory.db` | messages, summaries, memory_chunks, facts, skills | compactacion explicita; sin politica temporal global documentada |
| Pensamientos SQLite | `userData/thoughts.db` (fallback cwd standalone) | `event_stream` por agente/tarea | sin retencion automatica visible |
| Indice FTS5 | `~/.sofia-semantic-indexer.db` | filepath, filename, content | reindex reemplaza contenido; daemon configurable |
| Knowledge Markdown | `userData/knowledge/` | `MEMORY.md`, `users/`, `memory/`, `PATHS.md` | escrituras/reescritura explicitas |
| Config JSON | `userData/*.json` | desktop, scheduler, canales, workflow, tools | overwrite atomico no garantizado en todos los servicios |
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

### Meetings

- `meeting_runs.trace_id` es unico; owner+source_hash+version evita duplicados.
- FKs de source/assets/sync/approvals usan cascade desde run; detection usa
  `SET NULL` para conservar candidato.
- `meeting_sync_actions.idempotency_key` evita duplicar efectos externos.
- `meeting_assets.confidence` mide la extraccion, no la verdad del contenido.
- `meeting_approvals` registra al decisor humano: la IA no aprueba.

## RLS y riesgo efectivo

El estado no es uniforme:

- tablas de monitoreo declaran `auth.uid() = user_id`;
- meeting y `hub_service_state` tienen RLS habilitado pero politicas
  permisivas para `anon, authenticated` porque main usa anon key sin sesion;
- por tanto el aislamiento de esas tablas depende hoy de filtros/validacion de
  aplicacion, no de una barrera tenant fuerte en Postgres.

Esto es un riesgo conocido expresamente comentado como migracion pendiente en los
SQL. No debe afirmarse que RLS protege por owner esas tablas. Endurecer requiere
propagar sesion/JWT confiable a main o una API backend y migrar politicas sin
bloquear el Hub.

## Migraciones y snapshots

### Sync cifrado del navegador: esquema preparado, no desplegado

`database/lia/migrations/browser-encrypted-sync.sql` es aditivo. El propietario
es `auth.uid()` de Lia, no el ID SOFIA enviado como argumento. Dispositivos
ligados a `session_id` firmado y a `auth.sessions` permiten revocar una sesión
sin aceptar que se registre otra vez con otro ID. Se exige `is_anonymous: false`
firmado: usuarios Auth anónimos también usan el rol authenticated y no deben
confundirse con titulares permanentes. No hay datos compartidos por
organización: una membresía no concede acceso al navegador personal ajeno.

RLS sólo permite SELECT propio a sesiones registradas activas; no hay políticas
de escritura directa ni acceso anónimo. RPC con `search_path` vacío serializan
registro, escritura y revocación por propietario. Los envelopes opacos conservan
última revisión por categoría y los recibos guardan SHA-256 del pedido cifrado,
idempotency_key y trace_id; ni claves, hostname, MAC ni correo se almacenan.
Categorías: marcadores, grupos, pestañas y ajustes, nunca contraseñas/passkeys.
El servidor valida formato y cuotas, no puede inspeccionar el plaintext cifrado.

Se verificó con PostgreSQL en memoria; aún no existe cliente remoto conectado
ni evidencia de aplicación en Lia. El rollout requiere sesión federada en main,
prueba de JWT/PostgREST real y aprobación de migración. El rollback operativo
`database/lia/rollbacks/browser-encrypted-sync-disable.sql` retira permisos sin eliminar datos.

### Convenciones de migraciones

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
