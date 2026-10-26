# Guardado de páginas en el proyecto activo

Fecha: 2026-10-24. Estado: corrección implementada localmente; sin escrituras en cuentas reales.

## Causa confirmada en código

El listado directo devolvía filas de `pm_projects` sin `role`/`membership.project_role`. El selector sólo aceptaba roles explícitos, por lo que descartaba incluso proyectos propios y mostraba ausencia de permisos. Además, el contexto del proyecto no viajaba desde AppWorkspace hasta el control del navegador: siempre se abría el selector.

## Corrección

El listado adjunta el rol efectivo con la misma precedencia que el detalle: administración del workspace, propiedad y membresía activa. Reutiliza la lectura de membresías que ya limita el listado y no añade una consulta de detalle por fila. Los roles de lector se conservan; no se conceden permisos nuevos.

El contexto verificado de organización/workspace/proyecto/nombre/capacidad se transmite explícitamente al navegador. El botón identifica el proyecto y guarda en él sin consultar el listado ni abrir el selector. Si se abre el navegador antes de cargar el panel, se verifica el proyecto seleccionado antes de abrirlo. Fuera de un proyecto se mantiene la selección explícita de destino.

El guardado mantiene la validación y confirmación de main. No se infieren destinos por nombre o conversación. No se guarda automáticamente cada navegación: la acción sigue siendo pulsar Guardar. Cambios de actor/organización/proyecto descartan acuses anteriores; un resultado incierto bloquea el reenvío. Un contexto de sólo lectura o de otra organización no permite guardar.

## Evidencia

- 124 casos aprobados, cero fallos en ProjectResources, useProjectWorkspace, BrowserWorkspaceLayout, IntegratedBrowserPanel y project-direct-database. Comando: `node node_modules/vitest/vitest.mjs run src/__tests__/components/ProjectResources.test.tsx src/__tests__/hooks/useProjectWorkspace.test.tsx src/__tests__/components/BrowserWorkspaceLayout.test.tsx src/__tests__/components/IntegratedBrowserPanel.test.tsx electron/__tests__/project-direct-database.test.ts --silent`.
- Regresiones: proyecto propio/miembro/lector y administrador con rol efectivo, sin consultas por fila; guardado contextual sin selector ni listado; selector sólo fuera del proyecto; contexto de otra organización/lector; resultados tardíos y escritura incierta; apertura del navegador durante la carga y cambio de ámbito mientras se verifica.
- `npm run typecheck`: aprobado tras la guarda de apertura anticipada.
- `npm run verify:pr`: aprobado. Suite completa: 519 archivos aprobados, dos omitidos; **5.897 casos aprobados, cinco omitidos, cero fallos**, en 125,50 s. La suite incluye los dos escenarios añadidos para apertura anticipada; typecheck y lint se repitieron sobre esa guarda final.

No se alteraron tablas, RLS, credenciales ni permisos; las pruebas usan el SDK Supabase con transporte simulado y componentes con dobles. No acreditan una validación manual en la cuenta real del usuario. Reversión: restaurar la normalización del listado y retirar el destino contextual del navegador; no se borran páginas guardadas.
