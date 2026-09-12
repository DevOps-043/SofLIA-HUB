# Verificación del importador de historial — 2026-09-05

## Alcance

Se completó la fase 4.6 para historial: selector nativo en main, preflight
acotado, resumen sin URLs ni rutas, confirmación con cancelar por omisión,
deduplicación por URL/timestamp, soporte JSON, JSONL y `last_visit_time` de
Chromium, y escritura SQLite transaccional por perfil. El renderer sólo recibe
conteos. La capacidad permanece detrás de `BROWSER_ADVANCED_HISTORY_ENABLED`.

## Evidencia focalizada

- `electron/__tests__/integrated-browser-history-importer.test.ts`: 6 casos;
  cancelación sin escritura, resumen redactado, entradas existentes,
  deduplicación, JSONL/Chromium, límites y guardia de concurrencia.
- `electron/__tests__/integrated-browser-handlers.test.ts`: el canal exige
  frame principal, no acepta rutas ni opciones y serializa sólo el resumen.
- `electron/__tests__/preload/source-cases.ts` y
  `electron/__tests__/preload/channel-cases.ts`: el bridge sólo expone
  `integrated-browser:history-import` y la allowlist conserva unicidad.
- `src/__tests__/services/integrated-browser-service.test.ts` y
  `src/__tests__/components/IntegratedBrowserPanel.test.tsx`: wrapper y panel
  refrescan la biblioteca y muestran los conteos posteriores a la importación.

## Límites y decisiones

- Cuota de lectura: 5 MiB; máximo 50 000 registros.
- Se aceptan objetos con `url`, `title` y `visitedAt`, además de
  `lastVisitTime`/`last_visit_time` en el formato Chromium. Sólo HTTP(S) llega
  al store.
- La revisión nativa no muestra contenido importado. Un cambio de perfil,
  ventana, generación o transición invalida la aprobación.
- Las visitas fuera de la retención, ya existentes o repetidas se omiten; la
  transacción completa hace rollback si el contexto cambia o SQLite falla.

## Revisión adversarial

Se intentó refutar la cuota con archivos que crecen, JSON corrupto, rutas y
URLs sensibles en los diálogos, duplicados con títulos distintos, reintentos
concurrentes y cambio de perfil durante la transacción. La prueba de rollback
confirma que un contexto obsoleto no deja un lote parcial; el título de una
visita ya existente tampoco se altera al omitirla.

## Pendientes que no se declaran resueltos

No se importan perfiles privados de otros navegadores, cookies, extensiones ni
formatos propietarios. El smoke de Electron instalado y el gate global de
`verify:pr` siguen siendo compuertas independientes.

`npm run verify:pr` se ejecutó tras integrar el canal: adapters, harness,
supply-chain, documentación y OpenSpec pasan; sólo falla la compuerta
preexistente `skills:seed:check` por la divergencia entre la migración de Lia y
el registro de Skills en código.
