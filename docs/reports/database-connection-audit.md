# Auditoria de conexiones y base de datos

Fecha: 2026-05-08

## 1. Entendimiento del objetivo

Se reviso SofLIA Hub contra `docs/prompt_maestro.md`, enfocando conexiones a Lia, SOFIA/SofLIA Learning, IRIS, Meeting Ops, App Chat y el punto de integracion CourseGen/CourseEngine. El objetivo es reducir lentitud, errores de conexion, bloqueos por picos de usuarios y riesgos de seguridad sin hacer cambios destructivos.

Supuesto importante: no se ejecutaron queries contra Supabase desde este entorno. Los scripts SQL quedaron listos para que se ejecuten manualmente en la instancia correcta.

## 2. Diagnostico tecnico

Hallazgos principales:

1. Habia clientes Supabase duplicados en renderer y main process. Esto aumenta drift de configuracion, timeouts inconsistentes y errores dificiles de depurar.
2. El `fetch` del renderer eliminaba el `AbortSignal`, pero no tenia timeout propio ni retry controlado. Una request colgada podia degradar UX.
3. Los clientes main de IRIS, Meeting Ops y App Chat no compartian una politica comun de timeout/retry.
4. App Chat preferia `SERVICE_ROLE_KEY` si existia en variables de entorno. En Electron esto es peligroso porque el escritorio del usuario no debe actuar como backend confiable.
5. Hay rutas calientes con `select('*')` y lecturas sin paginacion fuerte, especialmente chats, shares, tracking e IRIS. Se requieren indices para que esas rutas no hagan scans grandes.
6. Los SQL historicos de `monitoring-tables.sql` y `meeting-ops-tables.sql` tenian politicas RLS `USING (true)`; quedaron reemplazadas por politicas owner-based.
7. `issue_number` en IRIS se calcula desde la app. Bajo concurrencia alta debe estar respaldado por constraint unica o, idealmente, por RPC/transaccion en BD.

## 3. Plan de implementacion aplicado

Cambios locales aplicados:

- `src/shared/supabase-http.ts`: fetch compartido con timeout de 25s y retries solo para GET/HEAD.
- `src/lib/supabase-factory.ts`: renderer usa el fetch resiliente sin reintentar escrituras.
- `electron/supabase-client-factory.ts`: factory main process para crear clientes Supabase con politica comun.
- `electron/iris/clients.ts`: IRIS/SOFIA main reutilizan el factory.
- `electron/meetings/meeting-iris-client.ts`: Meeting Ops IRIS reutiliza el factory.
- `electron/app-chat/clients.ts`: App Chat reutiliza el factory y bloquea `SERVICE_ROLE_KEY` por defecto.
- `src/__tests__/lib/supabase-http.test.ts`: pruebas de retry idempotente y no-retry en POST.

## 4. Queries creadas

Ejecutar por instancia, no mezclar:

- `database/shared/audits/db-health.sql`: solo lectura. Ejecutar primero en Lia, IRIS y SOFIA/Learning para ver conexiones, scans, indices, RLS y FKs sin indice.
- `database/lia/migrations/performance-hardening.sql`: indices para conversaciones, mensajes, shares, workspace sources y monitoring.
- `database/iris/migrations/performance-hardening.sql`: indices para equipos, proyectos, issues, catalogos y miembros.
- `database/sofia-learning/migrations/performance-hardening.sql`: indices para login SOFIA, organizaciones/equipos, Learning y CourseGen/CourseEngine inbox.
- `database/shared/migrations/security-rls-hardening.sql`: script idempotente para reemplazar politicas heredadas `USING (true)` por RLS owner-based en Lia Monitoring/OAuth y Meeting Ops.

Notas:

- Los scripts usan `CREATE INDEX CONCURRENTLY IF NOT EXISTS` para minimizar bloqueo. No deben ejecutarse dentro de `BEGIN/COMMIT`.
- Las constraints unicas potencialmente riesgosas quedaron comentadas y precedidas por queries de duplicados.
- Si Supabase SQL Editor no permite `CONCURRENTLY` en lote, ejecutar cada `CREATE INDEX CONCURRENTLY` por separado.

## 5. Riesgos y validaciones

Validar manualmente despues de ejecutar SQL:

1. Login SOFIA por email/username.
2. Login tras cambio de password desde SofLIA Learning.
3. Listado de chats y carpetas con usuario dueño y usuario invitado.
4. Project Hub: cargar equipos/proyectos y abrir issues por proyecto.
5. WhatsApp IRIS: crear issue y proyecto.
6. Meeting Ops: listar runs y candidates.
7. CourseGen/CourseEngine: consumir registros `pending` y reintentar `error`.

Riesgos residuales:

- RLS debe aplicarse con `database/shared/migrations/security-rls-hardening.sql` en las instancias indicadas por el script, despues de confirmar que `auth.uid()` coincide con `user_id`/`owner_user_id`.
- Algunas rutas siguen trayendo payloads amplios con `select('*')`; los indices reducen dolor inmediato, pero la siguiente mejora debe ser paginacion/campos explicitos.
- Para IRIS, el siguiente paso recomendado es una RPC atomica `create_issue` que reserve `issue_number` en BD y use `idempotency_key`.

## 6. Mejoras adicionales recomendadas

Obligatorias antes de produccion amplia:

- Eliminar `SERVICE_ROLE_KEY` de builds distribuidos y mover accesos multiusuario a RPCs con `SECURITY DEFINER` y validacion explicita.
- Validar en Supabase que las politicas RLS owner-based quedaron activas y que no existen politicas permisivas heredadas.
- Convertir escrituras multi-tabla manuales en RPC/transacciones, especialmente deletes de proyectos y creacion de issues.

Deseables:

- Instrumentar metricas por cliente Supabase: latencia, timeout, retry count, error code y proyecto destino.
- Agregar paginacion cursor-based en mensajes, conversations y project lists.
- Activar `pg_stat_statements` si no esta habilitado y revisar top queries semanalmente.
