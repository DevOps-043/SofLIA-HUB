## Why

El menú de herramientas del navegador integrado acumulaba 25 acciones, mezclando
las del navegador con las de una pestaña concreta (fijar, duplicar, silenciar,
cerrar otras). Además:

- Los atajos (Ctrl+F, Ctrl+P, Ctrl+Mayús+T) sólo escuchaban en el renderer. Con
  el foco en la página, que es una vista nativa, nunca llegaban: sólo
  funcionaban con el foco en la barra.
- Ctrl+rueda no hacía nada con Electron 44. Cuando existe `setZoomMode`, el
  manejador de `zoom-changed` salía antes de tiempo, y Electron no amplía por
  su cuenta (comprobado con una sonda sobre 44.0.0-beta.3).
- Silenciar sólo se ofrecía desde el menú, no sobre la pestaña como en Chrome.

## What Changes

- Tabla única de atajos de Chrome compartida por main, renderer y menús.
- Main resuelve en `before-input-event` las teclas pulsadas en la página y las
  entrega por el canal de evento `integrated-browser:command`, que sustituye a
  `integrated-browser:find-requested`. No intercepta mientras el agente controla
  la vista.
- Menú nativo de pestaña (`integrated-browser:tab-context-menu`) con las
  acciones de pestaña, e icono de sonido en la pestaña. `page-mute` acepta un
  `tabId` opcional y el estado de pestaña añade `audible`.
- Menú general por secciones, con atajos visibles y fila de zoom/pantalla
  completa.
- `zoom-changed` aplica el zoom por pestaña también en modo aislado.

## Capabilities

### New Capabilities
- `browser-controls-layout`: atajos de teclado, menú de pestaña, audio por pestaña y menú general.

### Modified Capabilities
Ninguna.

## Impact

Servicio y handlers del navegador en main, preload y allowlist (un canal
invocable nuevo; un canal de evento renombrado), wrapper del renderer, barra de
pestañas, pestañas verticales, menú de herramientas y panel. Sin dependencias,
migraciones ni cambios de permisos del agente.

No objetivos: personalizar atajos, nueva ventana o incógnito, ni el submenú de
marcadores de Chrome.
