# Evidencia de verificacion

Fecha: 2026-08-04. Entorno: Windows, Node 24.16.0, Electron 39.8.5.

## Resultado

- Pruebas dirigidas finales: 7 archivos, 22 casos aprobados. Una corrida previa
  que incluyo allowlist/preload aprobo 8 archivos y 46 casos.
- `npm run typecheck`: aprobado.
- `npm run lint:changed`: 30 archivos revisados, sin deuda nueva.
- `npm run harness:validate`: 25 rutas y 8 skills validas.
- `npm run docs:check`: 143 Markdown activos con enlaces validos.
- `npm run docs:system:check`: 28 documentos, 144 IDs, 295 canales y 295
  archivos de prueba consistentes.
- `npm run openspec:validate`: 9 cambios aprobados en modo estricto.
- `npm run build:app`: aprobado para renderer, main y preload; conserva warnings
  preexistentes de chunks grandes/imports mixtos.

## Excepcion ambiental de suite completa

`npm run test` y, por consecuencia, `npm run verify:pr` no pudieron reconstruir
`better-sqlite3` para la ABI de Node porque la aplicacion Electron abierta mantiene
`better_sqlite3.node` bloqueado (`EBUSY`/`EPERM`). No se cerro la aplicacion del
usuario por la fuerza. `npm run test:fast` ejecuto el resto: 119 de 120 archivos y
1.031 de 1.052 casos aprobaron; los 21 fallos pertenecen exclusivamente a
`memory-service.test.ts` y reportan ABI 140 frente a 137 antes de crear la DB.

Para cerrar la compuerta completa: cerrar todas las instancias de SofLIA que usan
ese binario y volver a ejecutar `npm run verify:pr`. El smoke Electron del
worktree tampoco se hizo en paralelo para no iniciar una segunda instancia con
servicios y perfil del usuario.

## Revision adversarial

Se revisaron secretos, origen de credenciales, paths de extensiones, permisos,
symlinks, estado parcial, colas de escritura, resize y cleanup. Hallazgos
corregidos:

- el registro de extensiones manipulado ahora falla cerrado y no carga paths
  externos al root administrado;
- la copia/carga de una extension se revierte si no puede persistirse el registro;
- los sitios de `content_scripts` aparecen en la confirmacion junto con permisos,
  origen seleccionado e identidad;
- eliminar credenciales exige coincidencia con el sitio actual y confirmacion
  contextual; secretos nunca vuelven por IPC;
- una escritura fallida ya no envenena permanentemente las colas de los stores;
- los errores al registrar historial quedan controlados y minimizados.
