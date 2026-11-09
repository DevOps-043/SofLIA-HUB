# Gestión funcional de proyectos

Estado: implementación local; migración y publicación remotas pendientes. Fecha de trabajo: 2026-10-23/24. Alcance: bloque 12 de [tareas](../tasks.md).

## Cambios

Tareas con edición completa, filtros, cursores, responsables, prioridades, fechas, estimaciones, ciclos, subtareas, etiquetas, comentarios, documentos e historial. Hitos con fecha/estado y cancelación conservadora. Archivos y documentos con edición y retirada de asociaciones. Equipo principal, directorio por nombre, integrantes, roles y permisos separados de los colaboradores del proyecto. Se conservan las transferencias nativas existentes, el lateral flotante, fuente e iconos del Hub.

Escritorio: rama `codex/project-panel`, worktree `.worktrees/project-panel`. Servidor Project Hub: rama `codex/hub-project-management`, worktree `.worktrees/hub-project-management`, base `86a87b9`. El checkout principal de Hub ya tenía cambios ajenos; el traspaso usa hashes independientes de origen y snapshot para no copiarlos ni sobrescribir ediciones posteriores.

## Contratos verificados

Se consultaron únicamente metadatos de IRIS: columnas, defaults, constraints, funciones y RLS. Se verificó `task_priorities.level`, estados de tarea `done/cancelled`, `pm_milestones`, documentos de proyecto/tarea, comentarios/historial/etiquetas y un equipo principal por proyecto. No hay relación tarea-hito ni asociación múltiple de equipos en el esquema observado. No se consultaron secretos ni se modificaron filas reales.

La [migración](../../../../database/iris/migrations/20261023-project-management.sql) añade operaciones atómicas restringidas a service role: tareas/historial/etiquetas, inicialización de equipo, integrantes, asignación de equipo y archivo de tareas. Reejecutable; el [rollback](../../../../database/iris/migrations/20261023-project-management.rollback.sql) retira solo funciones conservando datos. La API autoriza workspace/proyecto y, cuando corresponde, equipo antes de invocar cada operación.

## Evidencia local

- PostgreSQL efímero: `node test/manual/project-panel/database-smoke.mjs <package.json-de-herramientas-PGlite>`. Pasaron 31 comprobaciones de migración/reejecución/rollback, permisos, propietario, referencias ajenas, subtareas cíclicas, revisión, archivo, etiquetas e historial. Incluye un fallo forzado a mitad de la creación del equipo para comprobar rollback completo. La dependencia de QA se instaló fuera de las dependencias del producto.
- Servidor: `node ../../node_modules/vitest/vitest.mjs run`, desde `apps/web`: 66 archivos, 474 pruebas correctas. Usa guardas reales de workspace/proyecto y dobles de persistencia; la lógica SQL se prueba además en PostgreSQL efímero. TypeScript del servidor correcto.
- Escritorio: pruebas de formularios, navegación, respuesta obsoleta, solo lectura, incertidumbre y las cuatro capas IPC. El transporte nuevo se comprueba contra HTTP real en loopback, con identidad y datos ficticios. La compuerta npm run verify:pr pasó: 498 archivos aprobados y 2 omitidos; 5,690 casos aprobados y 5 omitidos. Lint incremental: 302 archivos sin deuda nueva. Pasaron contratos, documentación, arnés y TypeScript. La compilación Vite de renderer/main/preload también pasó, con las advertencias de tamaño de chunks existentes.
- Electron: `node test/manual/project-panel/smoke.mjs` comprueba crear/editar tarea, comentar, crear hito, vincular/desvincular documento y añadir/retirar integrante. Una sola ventana, sin tabs de navegación, ambos temas y tamaño compacto. Fixture sin preload real, credenciales ni servidor de producción. Capturas: [tareas](project-management-tasks.png), [hitos](project-management-milestones.png), [equipo](project-management-team.png).

## Revisión adversarial y límites

Se intentó cruzar workspace/proyecto/tarea/equipo, falsificar autor o campos de almacenamiento, promocionar un propietario desde roles ordinarios, enviar cursores manipulados, sobrescribir revisiones obsoletas y duplicar escrituras inciertas. Se protegieron jerarquías y numeración con bloqueos; cancelar una referencia no borra originales. Se corrigió la consulta inválida `priority_level` y el conteo truncado a una página.

El RLS heredado de tareas/hitos estaba deshabilitado; esta entrega no amplía acceso directo ni certifica otros clientes. Las nuevas funciones deniegan ejecución a `anon/authenticated/PUBLIC`. La creación/edición usa bloqueo coordinado dentro de las rutas nuevas; los escritores heredados que no utilizan estas funciones requieren auditoría antes de certificar concurrencia global.

La API local y las pruebas aisladas no acreditan despliegue ni permisos reales del proveedor. Faltan autorización explícita, respaldo/revisión, migración IRIS, despliegue del servidor y E2E de dos actores en el entorno elegido. No se certifican OAuth directo, sincronización de carpetas, múltiples equipos, relación tarea-hito ni pertenencia durable de chats por completar esta unidad.


## Traspaso y recuperación

Se integraron selectivamente 50 archivos del Hub y 31 de Project Hub, sin conflictos y comprobando SHA-256 contra el contenido probado. Los originales anteriores al traspaso permanecen en .management-handoff-backup dentro de cada worktree; los manifiestos .management-handoff.json registran rutas y hashes. No se hizo reset, stash, commit global, push ni despliegue. La revalidación del checkout principal del Hub pasó TypeScript, enlaces de 698 documentos y arnés. El smoke nativo también pasó en el checkout principal, al igual que las 31 comprobaciones PostgreSQL efímeras. La caché de Vite y el perfil Electron de la fixture se crean en temporales separados; cada espera de UI tiene tiempo máximo. OpenSpec pasó validación estricta. El build Next de Project Hub pasó; su suite final es de 66 archivos y 474 casos correctos, y su lint dirigido no reporta incidencias.
