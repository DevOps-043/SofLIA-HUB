## Context

`runBootstrap` en `electron/main/bootstrap.ts` construye módulos, servicios,
estado y controles; espera `app.whenReady()` y luego llama
`initializeMainServices`. En `electron/main/startup.ts`, esa función ejecuta en
serie ~30 pasos `await runOptionalStep(...)` (memoria, conocimiento, meetings,
SDO, workspace, workflow, detección pasiva, path memory, updater, scheduler,
clipboard, briefing, communication hub, background host, remote node, telegram,
learning, dynamic tools, python runtime) **antes** de
`controls.createWindow(...)` (línea ~96). La ventana, y por tanto el primer
pintado del renderer, quedan detrás de toda esa cadena.

`createOrFocusMainWindow` en `electron/main/window-controller.ts` crea la ventana
con `show: showWindow` y llama `loadURL`/`loadFile` sin esperar `ready-to-show`.
En autostart (`--background`), `runtime-state.ts` fija
`shouldShowInitialWindow=false`, por lo que la ventana se crea oculta.

El audio de intro se dispara en `useStartupIntroAudio` de
`src/app/AppLoadingScreen.tsx` al montar el componente, con un `setTimeout(120ms)`
y una animación visual de `4.05s`, sin señal que lo ligue a la visibilidad de la
ventana ni al primer pintado.

## Goals / Non-Goals

**Goals:**

- Medir el arranque antes de optimizar y dejar la instrumentación como evidencia
  reproducible.
- Crear y mostrar la ventana lo antes posible, sin destello en blanco.
- Diferir la inicialización de servicios no esenciales para el primer pintado.
- Coordinar audio de intro, primer pintado y visibilidad con una señal única.
- Preservar el modo `--background` y el comportamiento del tray.

**Non-Goals:**

- Rediseñar la pantalla de carga o su estética.
- Reescribir el ciclo de vida de los servicios más allá de su fase de arranque.
- Optimizar el tiempo de compilación de Vite (solo medirlo y documentarlo).
- Cambiar contratos de datos, Supabase o el modelo de autorización.

## Decisions

### Instrumentar antes de reordenar

Se añade una utilidad de marcas de arranque en el proceso principal que registra
`fase`, `t_relativo_ms` y `duración_ms` con log estructurado en español. Es la
fuente de evidencia para fijar y verificar presupuestos; ninguna optimización se
declara sin una medición antes/después.

Alternativa descartada: optimizar directamente por intuición. El estándar §8
exige localizar la ruta caliente y medir el cuello de botella primero.

### Ventana temprana + `ready-to-show`

`createWindow` se invoca justo después de `app.whenReady()` y del registro mínimo
necesario, no al final de la cadena de servicios. La ventana visible espera el
evento `ready-to-show` para evitar el destello en blanco. En `--background` la
ventana se crea con `show:false` y solo se muestra por acción del usuario/tray,
sin reproducir el audio de intro.

Alternativa descartada: mantener el orden actual y solo acelerar servicios. No
resuelve el problema estructural: la ventana seguiría detrás de la cadena.

### Fase diferida de servicios no esenciales

Los pasos de `initializeMainServices` se clasifican en:

- **Esenciales para el primer pintado**: lo mínimo para que el renderer sea
  funcional (p. ej. lo que el login/workspace consulta de inmediato).
- **Diferibles**: el resto (detección pasiva, briefing, telegram, background
  host, remote node, learning, dynamic tools, autoconexión WhatsApp, etc.), que
  se ejecutan tras la señal de "listo" sin bloquear la ventana.

La reclasificación exacta se decide con la evidencia de la instrumentación y se
protege con una bandera de reversión que restablece el orden serial anterior.

Alternativa descartada: paralelizar todos los pasos con `Promise.all`. Riesgo de
condiciones de carrera entre servicios con dependencias implícitas; se prefiere
diferir de forma controlada y observable.

### Señal única de coordinación audio/pintura/visibilidad

El renderer emite una señal de "listo/visible" (por IPC `app:renderer-ready` o
por un gate interno del renderer si no requiere main). El audio de intro se
dispara con esa señal, no al montar. Así el sonido acompaña a la primera pintura
y no suena con la ventana oculta. Si se usa IPC, el canal cruza
servicio/handler/preload allowlist/wrapper tipado por
`docs/standards/electron-ipc.md`.

## Risks / Trade-offs

- [Reordenar servicios rompe una dependencia implícita] → Reclasificar con
  evidencia, cubrir con pruebas dirigidas y proteger con bandera de reversión al
  orden serial previo.
- [`ready-to-show` no dispara en algún entorno] → Fallback con timeout que
  muestra la ventana de todos modos y registra la anomalía.
- [La señal de audio no llega y el intro no suena] → Fallback que reproduce el
  intro tras un timeout acotado, preservando la política de no sonar oculto.
- [Métricas variables entre máquinas] → Registrar presupuestos como rangos y
  medir en condiciones equivalentes (misma máquina, frío vs. caliente).

## Migration Plan

1. Añadir instrumentación de arranque y capturar línea base (frío tras reinicio,
   caliente, `--background`).
2. Introducir `ready-to-show` y creación temprana de ventana detrás de bandera.
3. Diferir servicios no esenciales según la evidencia, detrás de bandera.
4. Coordinar audio con la señal única de "listo/visible".
5. Fijar presupuestos en `docs/architecture/runtime-parameters.md` y verificar
   antes/después. Ejecutar OpenSpec, tipos, lint incremental, pruebas dirigidas y
   `verify:pr`.

Rollback: la bandera restablece el orden serial y la creación tardía de ventana;
la coordinación de audio revierte al disparo por montaje. No hay cambios de datos
ni estado remoto que deshacer.

## Open Questions

- ¿La coordinación de "listo" debe pasar por IPC (`app:renderer-ready`) o basta un
  gate del renderer? Se decide al implementar según si el main necesita conocer el
  evento para `show()`; ambas rutas quedan cubiertas por el spec de coordinación.
