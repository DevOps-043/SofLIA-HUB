# Evidencia de verificación

Fecha: 2026-08-04.

## Resultado

La implementación y sus contratos dirigidos pasan las verificaciones estáticas,
documentales y funcionales ejecutables en el worktree. La compuerta completa de
PR llegó hasta `npm run test`, donde quedó bloqueada por el binario compartido de
`better-sqlite3` que está cargado por una sesión `npm run dev` ajena al worktree.
No se detuvo ni modificó esa sesión del usuario.

## Evidencia aprobada

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Pasa. |
| `npm run lint:changed` | Pasa: 39 archivos sin deuda nueva. |
| Vitest main dirigido al navegador/IPC/preload | Pasa: 5 archivos, 42 pruebas. |
| Vitest renderer dirigido a panel/wrapper/Sidebar | Pasa: 3 archivos, 9 pruebas. |
| Vitest renderer completo | Pasa: 30 archivos, 141 pruebas. |
| Vitest main excepto `memory-service` | Pasa: 86 archivos, 879 pruebas. La exclusión es solo por la ABI nativa bloqueada descrita abajo. |
| `npm run adapters:check` | Pasa: 24 adaptadores. |
| `npm run harness:validate` | Pasa: 25 rutas y 8 skills canónicas. |
| `npm run docs:system:check` | Pasa: 28 documentos, 142 IDs, 285 canales y 292 archivos de prueba. |
| `npm run docs:check` | Pasa: enlaces válidos en 133 Markdown activos. |
| `npm run openspec:validate` | Pasa en modo estricto: 8 cambios, 0 fallos. |
| `npm run build:app` | Pasa: renderer, main y preload generan bundles de producción. Conserva advertencias históricas de tamaño/chunking. |

## Compuerta PR y limitación ambiental

`npm run verify:pr` aprobó adaptadores, arnés, documentación de sistema,
enlaces, OpenSpec estricto, TypeScript y lint. Al preparar la suite total,
Windows devolvió `EBUSY/EPERM` sobre
`node_modules/better-sqlite3/build/Release/better_sqlite3.node`.

La sesión de desarrollo activa usa Electron ABI `NODE_MODULE_VERSION 140`,
mientras Node/Vitest 24 requiere ABI `137`. El lanzador necesita reconstruir
temporalmente el módulo y restaurarlo después; Windows no permite reemplazarlo
mientras el proceso Electron lo mantiene abierto. El smoke manual del build
aislado queda igualmente pendiente para no interferir con esa sesión.

Para cerrar la compuerta en una ventana sin la aplicación abierta:

```powershell
npm run verify:pr
```
