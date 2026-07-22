## Why

Al iniciar la aplicación —sobre todo tras reiniciar la computadora con autostart
en segundo plano— el arranque se siente lento y el sonido de intro se escucha
varios segundos antes de que aparezca contenido visible. La causa está en el
orden de arranque del proceso principal: en
`electron/main/startup.ts` la ventana (`controls.createWindow`) se crea **después**
de una cadena de ~30 pasos `await` secuenciales que inicializan servicios
pesados (memoria, conocimiento, meetings, SDO, workspace, workflow, telegram,
runtime de Python, etc.). La ventana no puede pintar hasta que toda esa cadena
termina.

Además, el audio de intro se dispara al montar `AppLoadingScreen` en el renderer,
sin coordinarse con una señal única de "listo" del proceso principal ni con el
primer pintado. Cuando el main está ocupado inicializando servicios, el renderer
tarda en hidratar y el resultado es un desfase perceptible entre el sonido y la
ventana. En modo `--background` (autostart) el desacople es mayor porque la
ventana se crea oculta y la reproducción de audio no está atada a su visibilidad.

Este cambio no promete cifras de rendimiento sin evidencia: primero instrumenta
el arranque, fija presupuestos medibles y luego reordena el arranque para
cumplirlos, conforme al estándar de ingeniería (§8) y a `docs/standards/base.md`.

## What Changes

- Instrumentar el arranque del proceso principal con marcas de tiempo por fase
  (`app.whenReady`, creación de ventana, primer pintado del renderer,
  inicialización de cada grupo de servicios) y registrarlas como log estructurado
  en español.
- Crear la ventana principal tan pronto como el proceso esté listo, **antes** de
  la inicialización de servicios no esenciales para el primer pintado, moviendo
  esas inicializaciones a una fase diferida posterior a la señal de "listo".
- Mostrar la ventana con la señal `ready-to-show` (o equivalente) para evitar el
  destello en blanco, preservando el modo `--background` (crear oculta, no
  reproducir intro hasta que la ventana sea visible).
- Coordinar el audio de intro con una señal única de "renderer listo/visible", de
  modo que el sonido y la primera pintura ocurran juntos y el audio no se
  reproduzca cuando la ventana no es visible.
- Registrar presupuestos de arranque (tiempo hasta ventana visible, tiempo hasta
  primer pintado) en `docs/architecture/runtime-parameters.md` y verificarlos con
  la instrumentación.

No objetivos: cambiar el diseño visual de la pantalla de carga; migrar a un
splash nativo separado; optimizar el tiempo del bundler en `npm run dev` más allá
de medirlo y documentarlo; alterar contratos IPC existentes o el modelo de
autorización; tocar la capa de datos o Supabase (cubierta por
`scale-hub-data-800-users`).

## Capabilities

### New Capabilities

- `desktop-startup-experience`: Arranque instrumentado y por fases del proceso
  principal, con creación temprana de ventana, inicialización diferida de
  servicios no esenciales y coordinación única de audio, primer pintado y
  visibilidad de ventana.

### Modified Capabilities

Ninguna. No existe un spec base publicado de arranque que este cambio modifique;
entrega la primera especificación observable del arranque.

## Impact

Afecta `electron/main/startup.ts`, `electron/main/bootstrap.ts`,
`electron/main/window-controller.ts`, `electron/main/window-controls.ts` y
`src/app/AppLoadingScreen.tsx` (coordinación de audio). Puede requerir un canal
IPC nuevo mínimo `app:renderer-ready` que cruce servicio/handler/preload
allowlist/wrapper tipado si la coordinación de "listo" se hace por IPC; se
declarará y validará según `docs/standards/electron-ipc.md`. No agrega tablas,
secretos ni dependencias. Riesgo de regresión en el orden de arranque de
servicios diferidos: se mitiga con banderas de reversión y pruebas dirigidas.
