# Verificación de apertura Linux

Fecha: 2026-10-11. Rama: `codex/fix-linux-application-open`.
Base: `d8c1de5`. Estado: corrección implementada; gate general con excepción
preexistente comprobada en Linux.

## Diagnóstico confirmado

- `resolveApplicationTarget` devolvía null para nombres fuera de Windows.
- El launcher usaba `shell.openPath` para ejecutables Linux.
- `focusExistingApplicationWindow` devolvía null fuera de Windows, de modo que
  una ruta directa lanzada tampoco obtenía una confirmación válida.
- La captura contiene una afirmación de éxito, pero no una traza de herramientas.
  No se afirma que el turno original haya llamado a un servicio específico.
- La sesión local es Wayland; Firefox está instalado como Snap y GIO disponible.
  No hay xdotool. Esto permite lanzamiento determinista, pero no control visual
  portable ni verificación de primer plano con el backend X11.

## Cambios y contratos

Se conserva `computer:open-application`, su preload, wrapper y las guardas
existentes. El servicio resuelve aplicaciones Linux por desktop entry o PATH;
usa GIO para desktop entries y spawn sin shell para ejecutables. En X11
comprueba proceso y ventana activa; el título por sí solo no constituye prueba.

`window_verified=true` permite afirmar que se comprobó la ventana.
`success=true` con `window_verified=false` informa solicitud aceptada, sin
afirmar apertura visual ni repetir el lanzamiento. La orden exacta reportada
usa una sola llamada real por el dispatcher; su respuesta se construye desde
el resultado, conserva timeout/cancelación y respeta el catálogo efectivo.

## Evidencia ejecutada

- Pruebas focalizadas finales: `npm run test -- application-open
  linux-application-window gemini-chat-routing computer-use-service
  computer-use-security --maxWorkers=3`: 84 aprobadas, una omitida (smoke opt-in).
- `PULSE_LINUX_FIREFOX_SMOKE=1 npm run test -- linux-application-open-smoke
  --maxWorkers=1`: una aprobada. Usa el servicio y GIO reales; Electron y el
  servicio de procesos Windows están simulados. Se constató después el proceso
  `firefox` en la máquina. No se comprobó visualmente la ventana ni el chat de
  la aplicación empaquetada. La prueba intentó abrir la aplicación real como
  efecto solicitado; la comprobación del proceso fue puntual.
- Typecheck, lint incremental, arnés, enlaces, inventario y OpenSpec ejecutados.
- Primer `npm run typecheck`: agotó el heap por defecto (2 GiB). Con
  `NODE_OPTIONS=--max-old-space-size=6144` identificó `pdfjs-dist` faltante.
  Se restauró únicamente la versión 6.4.299 declarada en el lockfile, verificando
  su integridad SHA-512 antes de extraer; no se modificó package.json ni lockfile.
  El typecheck posterior pasó.
- La primera compuerta pidió sincronizar el inventario de pruebas; se actualizó
  con `npm run docs:inventory:sync`. La revisión de lint detectó dos `any`
  nuevos en una prueba y se sustituyeron por tipos válidos.
- Compuerta completa anterior: 4184 aprobadas, seis fallidas y dos omitidas,
  396 archivos aprobados, uno fallido y dos omitidos. Los seis fallos pertenecen
  a `electron/__tests__/desktop-context-cascade.test.ts` (rutas Office Windows).
- Línea base reproducida en `.worktrees/linux-open-baseline`, HEAD `d8c1de5`:
  `npm run test -- desktop-context-cascade --maxWorkers=1`: los mismos seis
  fallos y once aprobadas. El checkout temporal limpio se retiró después.
- Compuerta final sobre el código terminado:
  `NODE_OPTIONS=--max-old-space-size=6144 VITEST_MAX_WORKERS=3 npm run verify:pr`:
  exit 1 únicamente en la suite completa, con 4185 aprobadas, los mismos seis
  fallos preexistentes y dos omitidas. Pasaron adaptadores, arnés, suministro,
  documentación, semilla, 57 cambios OpenSpec, typecheck y lint incremental.
- `NODE_OPTIONS=--max-old-space-size=6144 npm run build:app`: exit 0;
  renderer, main y preload compilados en `dist/` y `dist-electron/`.
  No se creó instalador ni se instaló una nueva versión empaquetada.

## Revisión adversarial

Auto-revisión con la guía `ai-specs/skills/adversarial-review/SKILL.md`;
no se presenta como revisión independiente ni se archiva el cambio.

Se intentaron refutar estas hipótesis: un chat cuyo título incluye Firefox
puede satisfacer la verificación; una activación rechazada devuelve éxito;
una aplicación ausente se lanza; un fallo de GIO o spawn se oculta; una orden
compuesta toma el atajo; un catálogo restringido, adjunto o cancelación amplía
permisos; un timeout vuelve a lanzar. Las pruebas cubren estos rechazos y
la conservación de una única llamada. La búsqueda y activación X11 tienen
presupuesto total acotado de cuatro segundos por comprobación.

Riesgo residual: no hay verificación visual portable de Wayland ni prueba real
de X11/Windows/macOS en esta máquina. Una aceptación del launcher puede preceder
un fallo posterior de la aplicación. No se creó instalador ni se reinició una
aplicación del usuario. Rollback: revertir los archivos del cambio; sin migración.
