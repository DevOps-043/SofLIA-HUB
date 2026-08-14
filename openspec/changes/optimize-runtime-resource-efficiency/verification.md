# Verificación

Estado: implementación verificada con una excepción preexistente en la compuerta global.

## Matriz de criterios

| Criterio | Evidencia |
|---|---|
| visible sin throttling; ocultas con throttling | prueba `prioriza solo las superficies visibles...` |
| dos superficies visibles protegidas | mismo caso en modo `split` |
| pestaña fría suspendida y restaurada | prueba `suspende una pestaña fría...` |
| audio protegido | mismo caso, antes y después de `audio-state-changed` |
| ventana oculta usa gracia corta | prueba `reduce el margen...` |
| reposo sin polling visual | prueba de percepción pasiva: una captura y ninguna adicional tras 60 s |
| observación explícita conserva DOM/captura | suite existente de `getObservation(true)` |
| diagnóstico apagado sin timer/consultas | `resource-diagnostics.test.ts` |
| diagnóstico agregado y redacted | mismo archivo: unidades, tipos, ausencia de URL/PID |
| comparación antes/después | `reports/resource-benchmark-2026-08-13.md` |

## Comandos ejecutados

- `npm run benchmark:resources`: OK. CPU 16,58 % → 4,86 %; working set 779,32 → 639,69 MB en fixture local.
- `vitest run --project main electron/__tests__/integrated-browser-service.test.ts electron/__tests__/resource-diagnostics.test.ts`: OK, 55/55.
- `npm run typecheck`: OK.
- `npm run lint:changed`: OK, 7 archivos sin deuda nueva en la corrida previa al reporte.
- `npm run harness:validate`: OK, 25 rutas y 8 skills.
- `npm run docs:check`: OK, 194 Markdown activos.
- `npm run docs:system:check`: OK, 28 documentos, 150 IDs, 346 canales y 373 archivos de prueba.
- `npm run openspec:validate`: OK, 18 cambios.
- `node --check` sobre ambos scripts de benchmark: OK.
- `npm run build:app`: OK; renderer, main y preload produjeron bundles. Conserva avisos preexistentes de chunks grandes e imports dinámicos no efectivos.
- `git diff --check`: OK; sólo avisos de conversión LF/CRLF de Git en Windows.

## Compuerta global

`npm run verify:pr` se ejecutó dos veces. La primera reveló inventarios derivados
desactualizados; se corrigieron a los valores calculados por el validador. La
segunda avanzó hasta `skills:seed:check` y se detuvo porque
`database/lia/migrations/system-skills-catalog.sql` no coincide con
`src/shared/skills/registry.ts`. Ninguno de esos archivos forma parte del diff y
regenerar la migración mezclaría el trabajo de presentaciones/skills existente.

Se ejecutaron manualmente las etapas posteriores. OpenSpec, tipos y lint
pasaron. La suite completa llegó al timeout de 600 s con un único fallo ajeno:
`WA-160` esperaba escribir `index.html`, pero la implementación de presentación
escribió `deck.json`. La reproducción aislada terminó en 0,74 s con 18/19 y la
misma discrepancia. No se modificó esa ruta fuera de alcance.

## Revisión adversarial

Hipótesis intentadas:

- una pestaña visible o en split podría recibir throttling: refutada por pruebas;
- una pestaña audible podría destruirse: refutada y cubierta;
- una ventana principal oculta podría conservar tres renderers: refutada, queda una caliente;
- un evento tardío de una vista destruida podría rearmar timers: se añadió guarda `isCurrentView`;
- teardown podría dejar el scheduler vivo: `stopResourcePolicyTimer()` es parte del cierre idempotente;
- métricas podrían filtrar URL, nombre o PID: el agregado descarta esos campos y su prueba negativa pasa;
- benchmark podría dejar procesos o perfiles ilimitados: salida determinista, perfiles fijos por modo y comprobación final sin procesos de benchmark;
- el cambio podría ampliar IPC, permisos o datos: no hay canales, handlers, migraciones, RLS ni secretos nuevos.

Riesgo residual: una pestaña suspendida recarga su URL y puede perder DOM/heap o
historial no persistido. Se mitiga con 90 s de gracia, una pestaña oculta caliente
y protecciones de visibilidad, carga, audio, captura, DevTools y agente. Falta un
smoke prolongado con los tres sitios reales del usuario; el diagnóstico opt-in
queda disponible para esa medición sin añadir costo cuando está apagado.
