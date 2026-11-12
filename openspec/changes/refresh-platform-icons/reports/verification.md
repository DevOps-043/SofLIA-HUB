# Verificación de iconografía compartida

Fecha: 2026-11-11. Estado: implementado; compuerta general con excepciones previas.

## Alcance comprobado

Catálogo SVG de Proyectos compartido con chat, carpetas, navegación y controles
de proyectos. Menú de herramientas y cabecera reutilizan iconos locales. Las
acciones de copiar, regenerar, valorar, editar, buscar, dictar y enviar usan la
misma base decorativa y movimiento. No cambian callbacks, permisos, IPC ni datos.

La implementación se aisló en `.worktrees/refresh-platform-icons`, rama
`codex/refresh-platform-icons`, copiando la línea base local sin moverla ni
descartarla. Los archivos propios se aplicaron después al directorio activo
comprobando hashes contra esa línea base. Se conserva el worktree de respaldo.

## Resultados

| Verificación | Resultado |
|---|---|
| `npm test` en worktree | 527 archivos aprobados, 2 omitidos; 5984 pruebas aprobadas, 5 omitidas; 385.50 s |
| Pruebas focalizadas: ChatInputArea, Sidebar, UnifiedProjectsSection, ProjectWorkspace y ProjectResources | 59 aprobadas en worktree |
| Repetición focalizada en directorio activo | 58 aprobadas, una falla intermitente en ProjectResources al consultar un archivo antes de resolver almacenamiento |
| Repetición aislada de ProjectResources y ToolsDropdownButton | 18 aprobadas; sin cambios adicionales de código |
| `npm run typecheck` en estado final, worktree y directorio activo | Aprobado |
| `npm run harness:validate` | Aprobado: 25 rutas y 10 skills canónicas |
| `npm run docs:check` | Aprobado |
| `npx openspec validate refresh-platform-icons --strict --no-interactive` | Aprobado |
| ESLint directo en los 15 componentes de iconografía | Aprobado, sin advertencias |
| Comparación ESLint de 16 archivos propios contra el contenido local original | 6 incidencias originales, 4 actuales, cero regresiones |
| `git diff --check` | Aprobado |

La primera ejecución de typecheck en el worktree no encontró las dependencias
separadas de Zoom. Se enlazaron las ya instaladas en el directorio original, sin
modificar manifiestos ni instalar dependencias. También se retiraron dos imports
de iconos sin uso que ya existían en SearchChatsModal.

## Chromium y accesibilidad

Una vista temporal montó SidebarTopActions, ProjectGlyph, ToolMenu y ShareButton
reales, junto con muestras del catálogo. Se inspeccionaron temas claro y oscuro
en Edge sin sesión ni datos remotos. No equivale a un recorrido autenticado de
toda la aplicación Electron.

Pasaron 14 comprobaciones: elevación/escala en hover; compresión al pulsar; foco
visible y avance del envío; disabled; fieldset deshabilitado; aria-disabled;
aislamiento del hover en controles anidados; hover propio de una acción anidada;
un callback por clic; giro del signo más; movimiento reducido en icono normal,
signo más y envío; ausencia de errores del renderer.

La revisión detectó que el selector especial de signo más/envío tenía mayor
especificidad que la regla inicial de movimiento reducido. Se corrigió y se
volvieron a comprobar ambos iconos con transformaciones y transiciones anuladas.

## Excepciones previas y límites

`npm run verify:pr` aprobó adaptadores, arnés y cadena de suministro y se detuvo
en `docs:system:check`: el inventario documenta 701 archivos de prueba, pero los
dos tests locales de borrado de carpetas existentes al iniciar elevan el conteo
a 703. Este cambio no añade tests al inventario ni modifica esa documentación.

`npm run lint:changed` también detectó incidencias ya presentes en los cambios
locales de AppModals, DeleteFolderModal, useAppViewHandlers-deleteFolder y
SearchChatsModal. No se amplió el baseline ni se alteró la gestión de carpetas.
La comparación contra el contenido local previo confirma cero incidencias nuevas
en los archivos propios; los fallos generales no se presentan como aprobados.

No se ejecutó empaquetado ni verificación de release. Logos, avatares y spinners
mantienen su implementación existente. Revertir los archivos de este cambio
restaura la presentación sin migraciones ni efectos externos.
