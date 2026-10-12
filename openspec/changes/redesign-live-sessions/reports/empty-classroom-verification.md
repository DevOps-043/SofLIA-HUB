# Verificación del aula vacía

Fecha: 2026-10-11. Estado: implementación local, verificación completada.

## Criterios

| Comportamiento | Evidencia |
| --- | --- |
| Aula independiente al elegir una clase o recibir una referencia | Pruebas de AppContent y del hook de referencia |
| Sin navegador, chat anterior, barra lateral ni agentes, incluso ante un evento de apertura del navegador | Pruebas de AppContent |
| Lienzo vacío con solo volver y cerrar, sin colaboración ni apertura de medios | Prueba del componente y fixture que rechaza esas llamadas |
| Ambos controles regresan a la agenda | Pruebas de AppContent y comprobación visual |
| Ambos temas y ancho reducido | Vista previa aislada en Chrome mediante Computer Use |

## Cambio

El ingreso anterior activaba el workspace del navegador y montaba su conversación. El aula ahora ocupa su propia vista. Se retiraron la antesala, las tarjetas, los formularios, Participar, Pulse Checks, Información y su hook de consultas periódicas. El cierre vuelve a la agenda y limpia la solicitud de mostrar navegador. Los contratos privados de Learning conservan sus controles de acceso.

## Evidencia ejecutada

- Suite focalizada: cuatro archivos, doce pruebas exitosas, incluyendo selección, referencia académica, evento del navegador y regreso mediante ambos controles.
- Inspección visual mediante Computer Use en Chrome: agenda → aula → tema claro → volver → reabrir → cerrar → reabrir a 390 × 844 px. Se observaron solo los controles volver/cerrar, cero hijos y texto vacío en el lienzo. Sin desbordamiento horizontal a 390 px ni errores de consola después de recargar la versión corregida. Se restauró el tamaño normal del navegador.
- Capturas actuales: [oscuro](aula-empty-dark.png), [claro](aula-empty-light.png) y [ancho reducido](aula-empty-mobile.png). La cabecera «Vista previa · Datos de ejemplo» pertenece exclusivamente a la fixture.
- `npm run typecheck`: exitoso. `node --check test/manual/live-sessions/verify.cjs`: exitoso.
- La primera compuerta detectó inventario de pruebas desactualizado; se sincronizó con `npm run docs:inventory:sync`. El lint inicial detectó un parámetro sin uso en la nueva prueba de navegación; se corrigió. La inspección visual detectó una regla CSS incompleta tras retirar el estilo anterior; se reparó antes de validar las capturas.
- `npm run verify:pr`: completado con código 0. Pasaron adaptadores, harness, cadena de suministro, documentación de sistema (544 archivos de prueba), enlaces, semilla, 51 cambios OpenSpec, typecheck y lint incremental (175 archivos sin deuda nueva). Suite completa: **378 archivos exitosos y 1 omitido; 3995 pruebas exitosas y 1 omitida**. Registro local: `hub-empty-classroom-gate.log`.
- `git diff --check` del árbol de trabajo: sin errores. El índice global conserva avisos de líneas vacías al final en archivos ajenos de equipos de agentes; no se alteraron esos cambios concurrentes.

## Reproducción y límites

Iniciar `npx vite --config test/manual/live-sessions/vite.config.mts` y abrir `http://127.0.0.1:4320/`. La vista usa datos de ejemplo y no lee `.env`, consulta cuentas reales ni reproduce medios. El script `test/manual/live-sessions/verify.cjs` se actualizó para el nuevo flujo; no se ejecutó en esta revisión, cuya inspección visual utiliza Computer Use. La exclusión del navegador nativo se cubre en AppContent; la vista previa no acredita una ejecución empaquetada de Electron.

El registro anterior y sus capturas se conservan como evidencia histórica en [verification.md](verification.md).
