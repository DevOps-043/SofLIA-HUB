# Evidencia de checkpoint de sesión

Estado: evidencia histórica de verificación local. Fecha: 2026-10-22.

## Alcance implementado

`BrowserSessionCheckpoint` concentra siete campos antes dispersos en el servicio:
temporizador, última promesa/snapshot/fallo, estado de preparación/confirmación y
revisión de cancelación. Se retiran 41 líneas netas del coordinador. El store
existente conserva validación, cola por archivo y escritura atómica. El servicio
conserva API pública, construcción del snapshot y guardas de perfil/recuperación;
el checkpoint no recibe el servicio entero ni importa Electron o filesystem.

La comparación AST de [firmas públicas](architecture-comparison.json) comprueba
144 miembros sin cambios; servicio de 5727 a 5686 líneas. Es una extracción
acotada: el coordinador sigue requiriendo futuras unidades arquitectónicas.

La cancelación se comprueba también después de la espera final de limpieza.
No cambian IPC, dependencias, formato persistido ni selección de pestañas sensibles.
No se calcula un porcentaje global de deuda a partir de líneas trasladadas.

## Verificaciones ejecutadas

Logs locales en `%TEMP%/soflia-browser-checkpoint-2026-10-22`.

| Comando / fase | Resultado |
|---|---|
| Servicio + session-store + app-lifecycle antes de modificar | 273 pruebas, 3 archivos; exit 0 (`baseline-tests.log`) |
| Checkpoint + servicio + store + sync-integration + lifecycle | 291 pruebas, 5 archivos; exit 0 (`focused-final.log`) |
| `npm run typecheck` | exit 0 (`typecheck.log`) |
| `npm run lint:changed` | 47 archivos, sin deuda nueva; exit 0 (`lint.log`) |
| `npm run docs:inventory:sync` | 608 archivos de prueba; 28 documentos, 150 IDs, 494 canales válidos |
| `browser:smoke:native -- --electron <instalado> --lifecycle-only` | Electron 44.5.1 real, cinco comprobaciones aprobadas, exit 0 (`native-lifecycle-final.log`) |

El primer smoke falló al importar `learning-live-session`, dependencia omitida
previamente en la preparación temporal. Se incluyó junto con `browser-home` y
se registran errores antes de importar módulos para evitar diálogos de Electron.
La repetición pasó en `%TEMP%/pulse-browser-smoke-A8LmqM`; el intento fallido quedó
en `%TEMP%/pulse-browser-smoke-TK32D7`. No se atribuye el primer fallo al producto.
Se conserva el [reporte nativo](native-lifecycle.json) con versión y comprobaciones.

## Casos negativos y revisión adversarial

- Autosave agrupado y captura tardía; commit/reset cancelan timers.
- Fallo de disco visible en la barrera; reintento sólo para el mismo scope.
- Una promesa antigua rechazada no contamina la escritura más reciente.
- No termina el cierre mientras escritura/limpieza estén retenidas; metadata
  recibida durante E/S entra en el checkpoint sin bucle por `savedAt`.
- Cancelación durante carga, escritura y última limpieza invalida el cierre.
- Guardas vencidas impiden escribir; recuperación y pestañas sensibles se
  conservan mediante las pruebas existentes del servicio, sin modificarlas.
- Revisión local del diff: no se trasladan permisos de main al renderer ni se
  agregan canales/secretos/logs con contenido de sesión. Revisión independiente pendiente.

## Límites y reversión

El smoke usa una ventana oculta y storage real temporal con cookies ficticias,
sin bootstrap, cuentas o perfil real. Verifica cancelación de beforeunload,
reanudación del guardado y persistencia antes de purga; el servicio completo se
verifica con Electron simulado en Vitest. Los dos avisos de parada de Python
provienen de módulos no incluidos en este harness: sidecars y toda la aplicación
instalada quedan fuera de esta fase. No hay evidencia nueva de Linux/macOS.

Revertir sólo módulo, integración, pruebas, preparación del smoke y documentación
de esta unidad; no requiere migración. Conservar los bloques anteriores del
worktree. No se archiva sin revisión independiente.

## Compuerta completa

`npm run verify:pr` terminó con exit 0: 4545 pruebas aprobadas, 5 omitidas y
ninguna fallida; 440 archivos aprobados y 2 omitidos, 205,73 s en Vitest.
Son 16 casos adicionales respecto al bloque anterior. Pasaron también las
cuatro pruebas de tooling, tipos, lint incremental (47 archivos sin deuda nueva),
adaptadores, arnés, supply chain, catálogo de skills, enlaces/documentación y
74 elementos OpenSpec en modo estricto. Log completo: `verify-pr.log`.

La suite existente de servicio/store/sync no se modificó para aceptar la
extracción. Esta autorrevisión no sustituye revisión independiente ni smoke de
instalador; ambos permanecen fuera de la evidencia de esta unidad.
