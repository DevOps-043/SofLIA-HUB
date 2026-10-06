## Context

La página del navegador integrado es una `WebContentsView` que se compone por
encima del renderer y se queda con el foco de teclado. Cualquier atajo
escuchado sólo en React deja de funcionar en cuanto el usuario hace clic en la
página.

## Decisions

- **Una tabla, tres consumidores.** `src/shared/browser-keyboard-shortcuts.ts`
  resuelve combinaciones, genera las etiquetas de los menús React y los
  aceleradores de los menús nativos. Así no hay mapeos que puedan divergir.
- **Un solo ejecutor.** Main no ejecuta atajos: resuelve el comando y lo entrega
  al renderer, que lo ejecuta con los mismos métodos del servicio que usan los
  botones (hook `useBrowserCommands`). Los comandos que escriben en la interfaz
  (dirección y búsqueda) mueven antes el foco a la ventana del Hub.
- **Alcance del teclado del renderer.** Sólo se interceptan las teclas cuyo
  destino está dentro del panel del navegador (o el `body`), para que Ctrl+W en
  el chat no cierre pestañas.
- **Agente.** Una sonda confirmó que `sendInputEvent` también dispara
  `before-input-event`; por eso no se intercepta mientras `agentControlling`.
- **Menú de pestaña nativo.** Evita superponer HTML a la vista nativa y coincide
  con Chrome. Las acciones reutilizan los métodos del servicio; «Agregar a un
  grupo» abre el editor del renderer por el canal de órdenes.
- **Validación.** El renderer descarta toda orden que no supere
  `isBrowserUiCommandRequest`, y los handlers validan `tabId`.

## Risks / Trade-offs

- Los atajos sólo se reenvían desde la pestaña activa. En vista dividida o en
  ventanas separadas, la pestaña secundaria no los recibe.
- Alt+D y F6 enfocan la dirección como en Chrome; una página que los use
  dejará de recibirlos.
- El icono de sonido depende de `audio-state-changed` y `isCurrentlyAudible()`.

## Migration Plan

Sin datos persistidos. El canal `find-requested` se sustituye en el mismo
cambio por `command`; no hay consumidores externos. Revertir restaura el menú
anterior y el manejador de zoom.
