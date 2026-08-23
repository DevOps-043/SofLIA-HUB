# Project Hub unificado

Estado: implementado detrás de configuración y migraciones pendientes de aplicar. Actualizado: 2026-08-21.

## Límites de dominio

Project Hub/IRIS es la fuente de verdad de proyectos nuevos, tareas, miembros, evidencia compartida y analítica. Lia conserva carpetas de chats, conversaciones, transcripciones completas, minutas y decisiones de aprobación. Solo cruzan hacia IRIS resúmenes aprobados, hashes, referencias y extractos breves.

Las carpetas existentes aparecen como **Carpetas heredadas** y no se migran. Crear desde la sección **Proyectos** usa la API v1 y registra en el outbox la creación idempotente de la carpeta colaborativa Lia.

## Flujo de autenticación

1. El renderer restaura o inicia la sesión SOFIA.
2. `auth:set-state` entrega el access token SOFIA a main exclusivamente para el canje.
3. Main llama `POST /api/v1/auth/sofia/exchange`; Project Hub verifica el token con SOFIA, sincroniza identidad/workspaces y emite tokens propios.
4. El access token queda solo en memoria. El refresh token y la lista no sensible de workspaces se cifran con `safeStorage`.
5. El cliente renueva en single-flight. Solo reintenta GET; una mutación no se repite salvo que el dominio use `Idempotency-Key`.

El renderer nunca recibe tokens Project Hub ni crea clientes IRIS/Supabase. La superficie pública está en `electron/project-hub/`, `electron/project-hub-handlers.ts`, `electron/preload/project-hub-api.ts` y `src/services/project-hub-api.ts`.

## Experiencia de proyecto

La vista formal incluye `Resumen`, `Chats`, `Tareas`, `Fuentes y evidencias`, `Miembros` y `Analítica`. Los estados sin sesión, API caída y reintento son explícitos. Archivos, Drive, enlaces e investigaciones del navegador se anexan como evidencia; las colecciones son versiones inmutables.

Guardar pestañas requiere selección humana. La captura reutiliza la extracción DOM del navegador integrado, limita cada texto a 50 KB y la API vuelve a sanear URLs. No se guardan cookies, credenciales, formularios ni screenshots.

## Reuniones y HITL

Meeting Ops conserva su revisión y aprobación. `MeetingSyncService` usa Project Hub cuando `MEETING_PROJECT_SYNC_V2` no es `false`: agrupa las acciones aprobadas por proyecto, crea una evidencia de reunión y crea o vincula tareas en una transacción idempotente. Sin aprobación, proyecto objetivo único o sesión autorizada no escribe.

## Datos y despliegue

- IRIS: `apps/database/migrations/024_project_hub_api_v1.sql` en el repositorio Project Hub.
- Lia: `database/lia/migrations/project-hub-federation.sql`.
- Contrato: `docs/openapi/project-hub-v1.yaml` en Project Hub.
- OpenSpec y verificación: `openspec/changes/integrate-project-hub-api/`.

Ninguna migración se aplica automáticamente. El orden es respaldo y revisión, migración IRIS, migración Lia, despliegue API y activación gradual de `PROJECT_HUB_API_V1`, `PROJECT_HUB_UNIFIED_UI`, `MEETING_PROJECT_SYNC_V2` y `BROWSER_COLLECTIONS`. El rollback operativo desactiva flags y conserva las migraciones aditivas; el outbox permite reanudar entregas.

La función Lia `project-hub-outbox` exige `PROJECT_HUB_OUTBOX_HMAC_SECRET`. Project Hub firma cada evento con `LIA_PROJECT_HUB_OUTBOX_HMAC_SECRET` y lo envía a `LIA_PROJECT_HUB_OUTBOX_URL`; ambos secretos deben contener el mismo valor. El worker de Project Hub se protege además con `PROJECT_HUB_OUTBOX_WORKER_KEY`. El consumidor solo usa `service_role`, no acepta JWT de renderer y rechaza firmas con más de cinco minutos.
