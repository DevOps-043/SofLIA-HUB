## 1. Instrumentación y línea base

- [x] 1.1 Añadir utilidad de marcas de arranque en el proceso principal con log estructurado en español (`fase`, `t_relativo_ms`, `duración_ms`). — `electron/main/boot-timeline.ts`, cableado en `bootstrap.ts`, `startup.ts`, `window-controller.ts`.
- [ ] 1.2 Capturar línea base en tres escenarios: frío tras reiniciar la computadora, arranque en caliente y modo `--background`; adjuntar evidencia bajo el cambio. — MANUAL en el host; la instrumentación ya emite los hitos.
- [ ] 1.3 Medir y documentar el tiempo de arranque de `npm run dev` (bundler) como referencia, sin optimizarlo en este cambio. — MANUAL en el host.

## 2. Ventana temprana y sin destello

- [x] 2.1 Crear la ventana principal justo tras `app.whenReady()` y el registro mínimo, detrás de una bandera de reversión. — `bootstrap.ts` crea la ventana antes del init pesado; `createOrFocusMainWindow` idempotente hace no-op la creación posterior; rollback `SOFLIA_STARTUP_LEGACY_ORDER=1`.
- [x] 2.2 Mostrar la ventana con `ready-to-show` (con fallback por timeout) evitando el destello en blanco. — `window-controller.ts` (`show:false` + reveal en `ready-to-show`, fallback 4000 ms).
- [x] 2.3 Preservar el modo `--background`: ventana oculta y sin audio de intro hasta que sea visible. — reveal solo si `showWindow`; audio gateado por visibilidad.

## 3. Inicialización diferida de servicios

- [x] 3.1 Clasificar los pasos de `initializeMainServices` en esenciales para el primer pintado y diferibles. — Enfoque conservador: la ruta crítica inicial (auth + primer data) usa Supabase desde el renderer, no servicios main; al crear la ventana en `bootstrap.ts` antes de `initializeMainServices`, toda la cadena queda diferida sin bloquear la ventana.
- [x] 3.2 Ejecutar los diferibles después de crear la ventana sin bloquearla, detrás de bandera de reversión. — `bootstrap.ts` (creación temprana + `SOFLIA_STARTUP_LEGACY_ORDER`).
- [ ] 3.3 Verificar que ningún servicio diferido rompa una dependencia (autoconexión WhatsApp, updater, scheduler, detección pasiva). — Razonado (handlers IPC ya registrados por bootstrap); requiere E2E manual en el host.

## 4. Coordinación de audio, pintura y visibilidad

- [x] 4.1 Señal única de "renderer visible": se usa `document.visibilityState` del renderer (sin IPC nuevo, el main gobierna la visibilidad vía `ready-to-show`). — `AppLoadingScreen.tsx`.
- [x] 4.2 Disparar el audio de intro con esa señal en lugar de al montar, sin reproducirlo con la ventana oculta. — gate + listener `visibilitychange`.
- [x] 4.3 Preservar la política de no sonar oculto: si la ventana nunca es visible, el intro no se reproduce. — `AppLoadingScreen.tsx`.

## 5. Presupuestos y verificación

- [x] 5.1 Registrar presupuestos de arranque y parámetros en `docs/architecture/runtime-parameters.md` (sección Arranque; cifras pendientes de medición en el host).
- [ ] 5.2 Verificar antes/después con la instrumentación y adjuntar comparación como evidencia. — MANUAL en el host.
- [x] 5.3 Actualizar documentación de arquitectura/operación afectada. — `docs/architecture/runtime-parameters.md`.
- [~] 5.4 Ejecutar `npm run typecheck`, `lint:changed`, pruebas dirigidas y `npm run verify:pr`. — typecheck OK; pruebas dirigidas OK (`window-controller.test.ts` 4/4, integración main 50/50); `lint:changed` y `verify:pr` pendientes de correr.
- [ ] 5.5 Revisión adversarial: regresiones de orden de servicios, destello, audio oculto, `--background`, fallbacks y rollback; adjuntar evidencia.
