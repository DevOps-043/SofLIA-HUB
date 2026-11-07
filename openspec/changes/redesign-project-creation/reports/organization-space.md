# Espacio automático de la organización

Fecha: 2026-10-24. Estado: corrección preparada y probada; publicación de la API y aceptación con cuenta real pendientes.

Actualización: el usuario descartó depender de la API web. Este reporte describe la alternativa anterior del servidor, que no se publicará como parte de esta tarea. La implementación vigente conecta directamente con IRIS desde main, según [el reporte de base directa](direct-database.md).

## Aclaración y diagnóstico

El usuario confirma que cada organización de Soflia Learning tiene su propio espacio en Project Hub. No debe crear ni elegir otro workspace ni crear un equipo como requisito para crear un proyecto.

Se inspeccionó `DevOps-043/Project-Hub` en la revisión `86a87b99682c2efa30dae7e5b98b81e76bae2e4c`. `completeSofiaLogin` llama a `syncWorkspacesFromSofia`, que sincroniza cada organización mediante `workspaces.sofia_org_id` y crea sus membresías. El cliente mantiene la resolución exacta por ese ID y sólo dentro de los workspaces autorizados.

El servidor añadía una precondición incorrecta: `resolveProjectTeam` devolvía 422 cuando el workspace no tenía equipos activos, aunque `pm_projects.team_id` es nullable en la migración 003 y el contrato de creación declara `team_id` opcional. La captura original no permite probar su código HTTP exacto, pero esa precondición sí está confirmada en el código y reproduce el fallo de un espacio nuevo sin equipos.

## Corrección del servidor

- Un equipo activo existente del mismo workspace conserva la asignación anterior.
- Si no se solicita equipo y no hay ninguno activo, se crea el proyecto en su workspace con `team_id: null`.
- Un equipo explícito debe pertenecer a ese mismo espacio y estar activo; no se sustituye por uno ajeno.
- Un fallo de consulta devuelve un error de servidor, en lugar de fingir que no hay equipos.
- Se conservan autorización, membresía, propietario, workspace, organización del evento de integración y aislamiento existente. No se crean equipos ni workspaces adicionales.

No requiere nueva migración ni cambia el contrato de entrada. La creación de tareas e importación de reuniones con tareas conservan su requisito actual de equipo y estados; el proyecto puede asignarse posteriormente mediante su configuración. No se promete retirar ese requisito distinto con este cambio.

La implementación está aislada en una copia Git del repositorio del servidor bajo el directorio de trabajo de esta tarea, rama `codex/organization-project-creation`. Se generó `project-hub-organizacion.patch` como entregable revisable. No se hizo push ni despliegue, ni se ejecutó SQL ni operaciones con las cuentas reales.

## Evidencia y revisión

- Servidor: suite completa de **443 pruebas aprobadas, cero fallos**; **23 casos focalizados** de resolución de equipo, sincronización de organizaciones y POST de proyecto. Los casos focalizados forman parte de la suite completa.
- Typecheck completo `tsc --noEmit -p apps/web/tsconfig.json`: aprobado.
- ESLint de los tres archivos TypeScript afectados: aprobado.
- Cliente: **44 casos focalizados aprobados**, lint incremental de 43 archivos sin deuda nueva, documentación e inventario correctos. La compuerta global del cliente conserva su bloqueo previo en `electron/gmail/raw-message.ts`.
- Casos negativos: sin sesión, sin membresía del espacio, equipo explícito ajeno/inactivo y fallo de consulta; no crean proyectos. El caso sin equipos comprueba que los efectos conservan workspace y `sofia_org_id` y que no insertan un equipo artificial.

El riesgo residual principal es el rollout: la API publicada sigue siendo autoridad. Una corrección local del modal no cambia su comportamiento remoto; falta publicar el parche y comprobar una creación autorizada en el entorno real.

## Confirmación con la nueva captura

La captura posterior muestra explícitamente `TEAM_REQUIRED`. El cliente sólo presenta esa traducción para HTTP 422 con el código contractual correspondiente, por lo que el rechazo por equipo deja de ser una hipótesis. El formulario envía nombre, prioridad y etiquetas sin solicitar equipo; corresponde al caso que la corrección preparada permite crear con equipo nulo.

La comprobación pública posterior encontró que la rama predeterminada de `DevOps-043/Project-Hub` aún conserva el rechazo incondicional cuando no encuentra equipo. El parche local sigue sin push ni despliegue. `/api/v1/health` respondió 200; esto acredita disponibilidad, no la publicación de la corrección ni la configuración de una organización concreta. No se consultaron datos privados ni se crearon proyectos para reproducir el rechazo.
