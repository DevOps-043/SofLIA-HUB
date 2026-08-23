## Why

SofLIA-HUB administra hoy carpetas de chats, reuniones, archivos y navegación como dominios separados. Hace falta una fuente de verdad de proyectos que permita relacionar tareas, miembros y evidencia sin copiar transcripciones ni exponer Supabase al renderer.

## What Changes

- Añadir una API REST `/api/v1` en Project Hub con autenticación federada, alcance obligatorio de workspace, permisos por proyecto, idempotencia y respuestas uniformes.
- Extender IRIS con evidencia versionada, actividad, outbox, archivos privados y asociaciones exactas entre tareas y sus fuentes.
- Consumir Project Hub exclusivamente desde Electron main mediante tokens cifrados, IPC validado y un wrapper tipado.
- Separar proyectos nuevos de las carpetas heredadas y ofrecer resumen, chats, tareas, fuentes, miembros y analítica.
- Importar reuniones y colecciones del navegador solo después de confirmación humana, conservando en Lia el contenido completo.

No objetivos: migrar carpetas existentes, copiar transcripciones completas a IRIS, ejecutar migraciones remotas, compartir secretos de Supabase o permitir que una recomendación de IA escriba sin aprobación.

## Capabilities

### New Capabilities

- `project-hub-api`: contrato federado y seguro para proyectos, tareas, miembros, evidencia, archivos y analítica.
- `meeting-project-import`: revisión e importación idempotente de resultados aprobados de reuniones.
- `browser-project-collections`: investigaciones versionadas creadas con pestañas seleccionadas.

## Impact

- IRIS: migración aditiva, storage privado, API Next.js y adaptadores heredados deprecados.
- Electron: cliente HTTP, almacenamiento seguro, handlers, preload y tipos.
- Renderer: experiencia unificada para proyectos nuevos y estados de degradación.
- Lia: referencias federadas y sincronización de acceso mediante outbox, sin mover transcripciones.
- Operación: flags de rollout, métricas sin contenido sensible y rollback por desactivación.

