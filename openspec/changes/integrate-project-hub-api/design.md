## Context

Project Hub/IRIS ya contiene proyectos y tareas, mientras SofLIA-HUB/Lia contiene chats, reuniones y el navegador integrado. Los endpoints `/api/ext/*` usan service role sin alcance de workspace y el renderer aún contiene accesos directos a IRIS. La solución debe mantener compatibilidad con carpetas heredadas y exigir HITL para resultados derivados por IA.

## Decisions

### IRIS es la fuente de verdad del proyecto

IRIS posee proyecto, membresía, tarea, evidencia compartida y analítica. Lia conserva chats, transcripción completa, minuta y aprobación. IRIS almacena referencias, hashes, resumen aprobado y extractos breves.

### Contrato federado, no credenciales compartidas

`POST /api/v1/auth/sofia/exchange` valida el access token SOFIA con el proveedor, sincroniza identidad y workspaces y emite tokens Project Hub. Electron main conserva únicamente el refresh token cifrado con `safeStorage`; renderer recibe resultados de dominio, nunca tokens ni clientes Supabase.

### Autorización doble: workspace y proyecto

Toda ruta resuelve primero membresía activa de workspace. Las operaciones sobre un proyecto requieren además owner/admin del workspace o membresía activa del proyecto. Los roles `viewer` y `guest` son lectura; `member` aporta evidencia y edita tareas; owner/admin administran proyecto y miembros.

### Evidencia inmutable y procedencia exacta

`pm_project_evidence` identifica el artefacto y su versión. `pm_project_evidence_items` contiene pestañas, decisiones, acuerdos, riesgos, preguntas y extractos. `task_issue_evidence` permite demostrar qué reunión, pestaña o archivo creó o respaldó una tarea. Una referencia externa y versión son únicas dentro del proyecto.

### Importación de reunión idempotente y aprobada

Lia prepara candidatos y acciones, pero no escribe. Tras aprobación, un endpoint transaccional ejecuta una función SQL con `Idempotency-Key`, adjunta la evidencia, crea o vincula tareas y registra decisiones/acuerdos. Repetir la solicitud devuelve la primera respuesta.

### Colecciones del navegador por versiones

Cada guardado crea una evidencia `browser_collection` nueva o una versión nueva, con hasta 50 pestañas. Main sanea URL y DOM, elimina esquemas y parámetros sensibles, limita el texto a 50 KB por pestaña y calcula SHA-256. No captura cookies, formularios ni screenshots.

### Archivos privados y Drive por referencia

Los uploads usan intención/finalización, bucket privado y URL firmada corta. Drive permanece autenticado por SofLIA y Project Hub solo recibe referencia y metadatos, nunca OAuth tokens.

## Security and privacy

- RLS habilitada y denegación por defecto en las tablas nuevas; la API server-side aplica autorización antes de service role.
- Máximo 10 archivos por operación y 20 MB por archivo; MIME permitido y validación final del objeto.
- Logs y métricas excluyen tokens, transcripciones y texto completo de páginas.
- `correlation_id` acompaña cada respuesta y evento de actividad.
- Las escrituras de reuniones/investigaciones exigen confirmación humana explícita.

## Migration and rollback

1. Aplicar la migración aditiva IRIS después de respaldo y revisión manual.
2. Activar `PROJECT_HUB_API_V1` para clientes piloto.
3. Activar `PROJECT_HUB_UNIFIED_UI`, luego reuniones y navegador.
4. Ante rollback, desactivar flags; conservar datos y rutas heredadas. El outbox reanuda entregas sin pérdida.

No se ejecutará SQL remoto desde este cambio.

