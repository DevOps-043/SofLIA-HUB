## Why

Todo lo que SofLIA aprende del usuario —mensajes, resúmenes de sesión, hechos y
skills aprendidas— vive únicamente en `userData/soflia-memory.db`, un SQLite por
equipo. Reinstalar la aplicación, cambiar de computadora o formatear borra la
memoria completa, aunque el usuario conserve su cuenta. El producto ya guarda en
Supabase las conversaciones (`public.messages`), las reuniones, los ajustes y el
catálogo de Skills: la memoria es lo único que sigue atado al disco local.

El archivo tampoco está cifrado en reposo —decisión explícita documentada en
`electron/memory/initializer.ts`— y no hay forma de auditar, respaldar ni
gobernar lo que la aplicación recuerda de una persona. Llevarla a la base de
datos con RLS por propietario resuelve las tres cosas a la vez: portabilidad
entre equipos, respaldo y gobierno del dato personal.

## What Changes

- Nuevas tablas de memoria del agente en la instancia Pulse Hub
  (`VITE_SUPABASE_URL`), con prefijo propio para no colisionar con las tablas ya
  existentes de conversación (`public.messages`) ni con las Skills invocables del
  usuario (`public.skills`): `agent_memory_messages`, `agent_memory_summaries`,
  `agent_memory_facts`, `agent_memory_skills` y `agent_memory_chunks`.
- **RLS por propietario**: cada fila pertenece a un `user_id` de `auth.users` y
  solo su dueño la lee o escribe. El `ownerKey` canónico `user:<id>` deja de ser
  una cadena en SQLite y pasa a ser una llave foránea real.
- **La memoria sin dueño autenticado se queda local.** Un WhatsApp sin número
  ligado (`phone:<num>`) y el owner de equipo sin sesión (`local:owner`) no se
  pueden atribuir a un usuario de `auth.users`; siguen en SQLite y nunca suben.
  El relink de un número ligado sí adopta su historial local.
- **SQLite pasa a ser caché y cola de escritura, no la fuente de verdad.** El
  agente sigue leyendo y escribiendo sin red (no puede quedarse mudo por una
  caída de Supabase); la sincronización es asíncrona y con reintentos, y el
  arranque hidrata la memoria del usuario desde la base.
- **Migración de lo existente**: al iniciar sesión, la memoria local con owner
  `user:<id>` sube una sola vez, marcada como migrada e idempotente por
  reejecución.
- **Recuerdo semántico**: los embeddings hoy se guardan como texto y la similitud
  se calcula en JavaScript. La búsqueda se mantiene con esa semántica; el vector
  viaja como dato del chunk y la decisión de mover el cálculo a `pgvector` se
  documenta en `design.md` como opción evaluada, no como requisito de este
  cambio.
- **Control del usuario**: la tarjeta *Memoria de IA* de los ajustes conserva
  ver y olvidar, y el borrado deja de ser solo local: borra también en la base.

### No objetivos

- Cambiar el aprendizaje en sí: umbral de resumen, extractores de hechos y
  skills, guardas de truncado e inyección de contexto se conservan tal cual.
- Migrar la base de conocimiento (`knowledge`), las reuniones ni el historial de
  WhatsApp fuera de la memoria del agente.
- Cifrar el SQLite local: sigue siendo la decisión pendiente que ya está
  documentada, y este cambio la reduce a una caché.
- Compartir memoria entre miembros de una organización: el alcance es por
  usuario, nunca por equipo.
- Sincronización en tiempo real entre dos equipos abiertos a la vez: la
  convergencia es eventual, con última escritura ganadora por fila.

## Capabilities

### New Capabilities

- `user-memory-store`: propiedad, persistencia y sincronización de la memoria del
  agente por usuario —qué se guarda, quién es su dueño, qué se queda local, cómo
  se hidrata y se sincroniza, cómo se migra lo existente y cómo se borra.

### Modified Capabilities

<!-- Ninguna: openspec/specs/ no contiene todavía especificaciones principales.
     Las reglas de alcance por owner que hoy viven en electron/memory/scope.ts se
     declaran completas en la capacidad nueva. -->

## Impact

- **Datos**: nueva migración en `database/lia/migrations/` con las cinco tablas,
  sus índices y políticas RLS por `auth.uid()`, más el bloque de rollback.
  `public.messages`, `public.conversations` y `public.skills` no se tocan.
- **Main**: `electron/memory/` completo (`service-messages`, `service-summary`,
  `service-facts`, `skills-store`, `service-context`, `service-embedding`,
  `initializer`, `scope`) y el cliente Supabase de main (`electron/hub-db-client.ts`),
  que hoy no habla de memoria.
- **IPC**: `memory:context`, `memory:record-turn`, `memory:list-skills`,
  `memory:delete-skill` y `memory:set-current-user` conservan su firma; se suma
  el estado de sincronización para que la interfaz pueda informarlo.
- **Autenticación**: la memoria pasa a depender de la sesión Supabase del Hub;
  sin sesión el comportamiento es el actual (memoria local).
- **Renderer**: `src/services/memory-bridge.ts` y
  `src/components/memory/MemorySkillsCard.tsx` (borrado que ahora viaja a la
  base y estado de sincronización).
- **Documentación**: `docs/data/data-architecture.md`,
  `docs/architecture/runtime-agents-manual.md`,
  `docs/architecture/runtime-parameters.md`, `docs/standards/database.md` y
  `database/README.md`.
