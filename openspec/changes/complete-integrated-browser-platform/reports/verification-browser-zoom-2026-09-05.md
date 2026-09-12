# Verificación de zoom por pestaña — 2026-09-05

## Alcance

El servicio configura cada `WebContentsView` con `setZoomMode('isolated')`
cuando la versión de Electron lo soporta. En runtimes anteriores mantiene el
factor lógico en la pestaña, evita sobrescribirlo con una propagación de
Chromium y lo reaplica al activar la vista. Los límites siguen siendo 50%–300%,
con incrementos de 10% y restablecimiento a 100%.

## Evidencia

- `electron/integrated-browser/service.ts`: modo aislado por vista, lectura del
  factor real y fallback de activación/snapshot.
- `electron/__tests__/integrated-browser-service.test.ts`: configuración del
  modo aislado, zoom observado, límites y duplicado.
- `test/mocks/electron/windowing.ts`: doble nativo con `setZoomMode` para no
  ocultar el contrato en las pruebas.
- `test/manual/browser-native/main.cjs`: el smoke exige aislamiento cuando la
  API existe y conserva una limitación explícita cuando se ejecuta con
  Electron 43.

## Verificación ejecutada

```text
npm run typecheck
npm run test -- electron/__tests__/integrated-browser-service.test.ts electron/__tests__/integrated-browser-page-tools.test.ts --run --maxWorkers=1
```

Resultado: typecheck aprobado; 2 archivos y 103 pruebas aprobadas.

## Límite residual

Electron 43.4.0 no expone `setZoomMode`; su política por origen puede cambiar
temporalmente el factor nativo de otra vista del mismo origen. La preferencia
de cada pestaña se conserva y se restaura al enfocarla, pero el aislamiento
nativo completo requiere un runtime que incluya la API aislada. El smoke no se
marca verde en ese caso y devuelve la limitación para que la actualización de
Electron sea una decisión explícita.
