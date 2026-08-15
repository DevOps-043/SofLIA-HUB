## 1. Custodia de la credencial en main

- [x] 1.1 Crear `electron/main/hub-session-store.ts`: guarda, lee y borra el refresh token cifrado con `safeStorage`. Si no hay cifrado disponible, NO escribe (ver `design.md` — D2).
- [x] 1.2 Ninguna función del módulo registra el valor del token; las trazas dicen qué pasó, no qué token.
- [x] 1.3 Pruebas: sin cifrado no se persiste; borrar deja el archivo inexistente; leer un archivo corrupto devuelve `null` sin lanzar.

## 2. Sesión del cliente del Hub

- [x] 2.1 Crear `electron/main/hub-session.ts` con `applyHubSession(tokens)`, `restoreHubSession()` y `revokeHubSession()`.
- [x] 2.2 `applyHubSession` llama a `setSession` sobre el cliente de `hub-db-client`, persiste el refresh token y actualiza el estado de auth.
- [x] 2.3 `restoreHubSession` lee el token guardado y hace `refreshSession`. Un token caducado o rechazado se descarta sin bloquear el arranque.
- [x] 2.4 `revokeHubSession` borra el token, hace `signOut` local del cliente y vuelve a `anon`.
- [x] 2.5 Ajustar `electron/supabase-client-factory.ts` para que el cliente del Hub admita sesión (`persistSession: false` se mantiene: la persistencia la hace main, no el SDK).
- [x] 2.6 Pruebas: aplicar sesión deja `auth.uid()` resuelto; revocar la retira; un refresh rechazado no lanza.

## 3. Contrato del canal de autenticación

- [x] 3.1 Ampliar `auth:set-state` en `electron/auth-state-handlers.ts` para aceptar `accessToken` y `refreshToken` opcionales, validados como cadenas no vacías.
- [x] 3.2 Separar el estado observable de la credencial: `auth:get-state` sigue devolviendo solo `{authenticated, userId}`.
- [x] 3.3 Actualizar el comentario de contrato de `electron/main/auth-state.ts`, que hoy afirma que no se aceptan tokens.
- [x] 3.4 Publicar los tokens desde el renderer en `src/contexts/auth/useAuthProviderModel.ts` y `src/services/auth-state.ts`.
- [x] 3.5 Al recibir `authenticated: false`, invocar `revokeHubSession`.
- [x] 3.6 Pruebas: un payload sin tokens sigue siendo válido; `auth:get-state` nunca devuelve credenciales; cerrar sesión revoca.

## 4. Restauración en el arranque

- [x] 4.1 Llamar a `restoreHubSession()` en el arranque, **antes** de `initializeMainServices` (ver `design.md` — D3).
- [x] 4.2 Registrar el resultado (restaurada / sin token / rechazada) sin incluir el token.
- [x] 4.3 Prueba: con token válido los servicios arrancan con identidad; sin token arrancan como `anon` sin error.

## 5. Tabla de Skills pasivas

- [x] 5.1 Escribir `database/lia/migrations/passive-skills.sql`: `(user_id, id)` como clave, columnas `profile`, `skill_id`, `name`, `description`, `prompt`, `cron_expression`, `schedule_label`, `channels`, `run_once`, `scheduled_for`, `phone_number`, `source`, `last_run_at`, marcas de tiempo.
- [x] 5.2 RLS por `auth.uid()` en las cuatro operaciones, con bloque de verificación y ROLLBACK.
- [x] 5.3 Índice por `(user_id, profile)` para la consulta por perfil.
- [x] 5.4 Añadir la tabla a `database/lia/snapshots/schema.sql`.

## 6. Persistencia del servicio

- [x] 6.1 Crear `electron/passive-skills/repository.ts`: `listForUser`, `upsert` y `remove` contra la tabla, con el mapeo a `PassiveSkillRule`.
- [x] 6.2 Cablear `PassiveSkillsService` para que la base sea la fuente de verdad y el `TaskScheduler` el ejecutor.
- [x] 6.3 `scheduler-state.json` pasa a contener solo las reglas del usuario activo y se reescribe tras cada lectura correcta de la base.
- [x] 6.4 Al cambiar de usuario o cerrar sesión, vaciar la caché local y detener los cron del usuario anterior.
- [x] 6.5 Retirar el espejo `hub_service_state` de `electron/task-scheduler/state-store.ts`.
- [x] 6.6 Pruebas: la base manda sobre la caché; sin red se levanta desde la caché; el cambio de usuario no deja rutinas ajenas activas.

## 7. Migración de las reglas existentes

- [x] 7.1 Implementar la migración descrita en `design.md` — D5, disparada al restaurarse la sesión.
- [x] 7.2 Idempotente por identificador de regla (`ON CONFLICT DO NOTHING`).
- [x] 7.3 Las reglas sin dueño resoluble se dejan y se registran; no se atribuyen a quien mira.
- [x] 7.4 Pruebas: migra las del usuario; no duplica al repetir; ignora las ajenas y las irresolubles.

## 8. Interfaz

- [x] 8.1 Que la tarjeta por perfil y la sección de Skills pasivas consulten por perfil.
- [x] 8.2 Mostrar un aviso cuando no haya sesión y por eso no se puedan cargar las reglas, en vez de afirmar que no hay ninguna programada.

## 9. Documentación y verificación

- [x] 9.1 Documentar la identidad de main y la custodia del token en `docs/architecture/runtime-agents-manual.md`.
- [x] 9.2 Añadir a `docs/security/security-and-privacy.md` la fila de la credencial y sus guardas.
- [x] 9.3 Añadir `passive_skills` a `docs/data/data-dictionary.md` y corregir la entrada de `hub_service_state`.
- [x] 9.4 Entrada en `CHANGELOG.md`, incluidos los dos defectos que esto corrige.
- [x] 9.5 Ejecutar typecheck, pruebas y `harness:validate`; dejar evidencia en `verification.md`.
