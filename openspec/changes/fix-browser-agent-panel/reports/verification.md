# Verificación del agente lateral del navegador

Estado: verificación completada con excepciones registradas. Fecha: 2026-11-11.

## Resultado

El navegador monta exclusivamente `BrowserWorkspaceLayout`, con chat lateral ajustable,
minimizable y reapertura por selección externa. Se retiró `BrowserFloatingWorkspace`.
El compositor flotante sólo se monta cuando existe navegación de proyecto y no se
muestra su sección de chat ni el navegador. El lateral conserva el lector de contexto
visible, el menú de conversaciones y el selector de modelo.

## Evidencia

- Línea base: las 25 pruebas existentes de BrowserWorkspaceLayout y FloatingSofliaChat pasaron antes del cambio.
- `npm run test -- src/__tests__/app/AppWorkspace-agent-placement.test.tsx src/__tests__/components/BrowserWorkspaceLayout.test.tsx src/__tests__/components/FloatingSofliaChat.test.tsx`: 28/28 pruebas en el worktree aislado y en el workspace principal.
- `npm run typecheck`: exitoso en el workspace principal.
- `npm run harness:validate`, `npm run docs:check`: exitosos.
- `npm run docs:inventory:sync`: inventario sincronizado conservando los cambios previos del documento.
- `npm run lint:changed` en el worktree aislado: 5 archivos sin deuda nueva.
- `npm run verify:pr` en el workspace principal: adaptadores, arnés, cadena de suministro, documentación de sistema, enlaces, semilla, 104 cambios OpenSpec, pruebas de calidad y typecheck exitosos. Se detuvo en lint por incidencias ajenas al cambio en AppModals, DeleteFolderModal y useAppViewHandlers-deleteFolder.test, ya modificados al inicio. No se alteraron esos archivos.
- ESLint directo señala además un setState en un efecto de BrowserWorkspaceLayout que ya existía en HEAD; el lint incremental aislado confirma que este cambio no agrega incidencias.
- `npm run test -- --silent`: 6004 casos exitosos, 5 omitidos y 2 fallidos por expectativas anteriores de compositor en productividad (527 archivos exitosos, 2 omitidos y 1 fallido). Las dos expectativas se actualizaron al alcance exclusivo de proyectos y se repitieron las cuatro suites afectadas: 34/34 pruebas exitosas.
- `git diff --check`: exitoso.

## Cobertura y límites

Las pruebas verifican ausencia del lanzador inferior, liberación y recuperación del
espacio lateral, cambio de conversaciones, modelo y razonamiento, redimensionamiento,
selección externa y permanencia del compositor en proyectos. No se realizó una
inspección visual de Electron ni se modificaron canales IPC o permisos.

## Recuperación

Revertir únicamente los archivos de este cambio restaura el layout previo.
El trabajo aislado se conserva en `.worktrees/fix-browser-agent-panel`, rama
`codex/fix-browser-agent-panel`; el arreglo también está aplicado en el workspace principal.
