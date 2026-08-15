## Why

El proceso main se conecta a la base de Pulse Hub con la clave anónima y **sin
sesión** (`persistSession: false`, ningún `setSession`). Su rol en Postgres es
`anon`, así que `auth.uid()` es `NULL` y toda política que dependa de la
identidad del usuario le devuelve cero filas —sin error—. Eso rompe en silencio
tres cosas que el producto ya promete:

1. **Las Skills del sistema que solo viven en la base no llegan a WhatsApp ni a
   Telegram.** La política de `system_skills` concede `SELECT` a `authenticated`;
   main recibe una lista vacía y cae al registro en código. Las seis Skills que
   sustituyeron a los flujos (Correo, Agenda, Seguimiento, Drive, Actualización
   de equipo y PC) solo funcionan en el chat del Hub.
2. **Desactivar una Skill en un canal no tiene efecto en ese canal.**
   `user_skill_channels` tiene RLS por `auth.uid()`; el Hub guarda la elección
   correctamente y main la ignora, que es justo donde tenía que aplicarse.
3. **Las Skills pasivas no son de nadie.** Se espejan en `hub_service_state` bajo
   una sola fila global (`service_name = 'task-scheduler'`), sin `user_id`, con
   una política permisiva `TO anon, authenticated USING (true)`. Dos usuarios de
   la misma base comparten esa fila y la última escritura gana: uno puede pisar
   las rutinas del otro. Cualquiera con la clave anónima lee los prompts de
   todos.

Las tres tienen la misma causa. Mientras main no tenga identidad, cualquier dato
por usuario que se añada al producto nacerá roto o inseguro.

## What Changes

- El renderer pasa a publicar al main, además del identificador de usuario, los
  **tokens de la sesión de Supabase**. El contrato del canal `auth:set-state`
  cambia: hasta ahora rechazaba tokens a propósito.
- Main guarda el token de refresco cifrado con `safeStorage` y aplica la sesión
  sobre su cliente de la base del Hub. Al arrancar la restaura **antes** de
  levantar los servicios, de modo que WhatsApp y Telegram funcionen sin ventana
  abierta.
- Al cerrar sesión, main borra el token, cierra la sesión del cliente y vuelve a
  ser `anon`.
- **Nueva tabla `public.passive_skills`**: una fila por Skill pasiva, con
  `user_id`, `profile` (el perfil de canal al que pertenece) y RLS por
  `auth.uid()` en las cuatro operaciones.
- `PassiveSkillsService` pasa a leer y escribir esa tabla. El JSON local
  (`scheduler-state.json`) se conserva como **caché de arranque** para que
  `node-cron` levante las rutinas sin depender de la red, no como fuente de
  verdad.
- **BREAKING (operativo)** Se retira `task-scheduler` del espejo global
  `hub_service_state`. Las reglas que hoy viven allí se migran a la tabla nueva
  la primera vez que su dueño inicia sesión.

### No objetivos

- No se cambia el modelo de Skills ni el de canales: esto sostiene lo que el
  cambio anterior ya definió.
- No se endurece `hub_service_state` para los demás servicios que lo usan
  (plantillas, meetings). Se acota a retirar de ahí las Skills pasivas.
- No se implementa sincronización colaborativa: la regla sigue siendo de un
  usuario, no de un equipo.

## Capabilities

### New Capabilities

- `main-process-identity`: identidad del proceso main frente a la base del Hub —
  publicación de la sesión, custodia del token, restauración sin ventana y
  revocación al cerrar sesión.
- `passive-skills-persistence`: persistencia por usuario y por perfil de las
  Skills pasivas, con la caché local como respaldo de arranque y la migración
  desde el espejo global.

### Modified Capabilities

<!-- `openspec/specs/` sigue vacío: las capacidades que este cambio corrige
     (`skill-channel-activation`, `unified-skills-model`) viven en el cambio
     `unify-workflows-into-skills`, todavía sin archivar. Este cambio las hace
     efectivas en los canales; no altera sus requisitos. -->

## Impact

**Código**

- `electron/main/auth-state.ts`, `electron/auth-state-handlers.ts`: el contrato
  acepta tokens y los separa del estado observable.
- `electron/hub-db-client.ts`, `electron/supabase-client-factory.ts`: el cliente
  del Hub deja de ser anónimo cuando hay sesión.
- Nuevo `electron/main/hub-session-store.ts` (token cifrado) y
  `electron/main/hub-session.ts` (aplicar, restaurar y revocar).
- `electron/passive-skills/`: nuevo repositorio contra la tabla.
- `electron/task-scheduler/state-store.ts`: deja de espejar en
  `hub_service_state`.
- `src/services/auth-state.ts`, `src/contexts/auth/useAuthProviderModel.ts`:
  publican los tokens.

**Datos**

- Nueva migración `database/lia/migrations/passive-skills.sql`.
- `hub_service_state` conserva la fila `task-scheduler` hasta que la migración
  la vacíe; el bloque de ROLLBACK la restituye.

**Seguridad**

Main pasa a custodiar un token de refresco. Es lo que hace posible el
aislamiento por usuario, pero mueve una frontera: se cifra con `safeStorage`, no
se registra en logs, no cruza IPC de vuelta al renderer y se borra al cerrar
sesión.

**Documentación**

`docs/architecture/runtime-agents-manual.md`, `docs/security/security-and-privacy.md`,
`docs/data/data-dictionary.md`, `CHANGELOG.md`.
