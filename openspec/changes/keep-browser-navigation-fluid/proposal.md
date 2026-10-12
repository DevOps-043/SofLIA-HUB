# Fluidez al escribir direcciones y alternar pestañas

## Why

La barra sustituye la página por una captura cuando muestra sugerencias. Ese
camino detiene visualmente las animaciones y agrega captura, codificación,
ocultación y espera de pintura al cambiar una dirección. La activación también
reaplica emulación de zoom aunque el factor y la geometría sigan iguales.

## What Changes

- Mantener la vista nativa visible debajo de las sugerencias, reservando solamente
  la altura que ocupa el desplegable y restaurándola al cerrar.
- Evitar reaplicar el mismo zoom a un documento con la misma geometría.
- Conservar captura y ocultación para gestores y avisos de permisos.
- Cubrir cierre, resize, cambio de perfil y nueva navegación con regresiones.

## Impact

Renderer de la barra/panel y zoom del navegador. Sin canales IPC, dependencias
ni cambios de sesión. Se trabaja en la rama `codex/browser-fluidity` conservando
los cambios locales del flujo anterior que el usuario pidió continuar.
