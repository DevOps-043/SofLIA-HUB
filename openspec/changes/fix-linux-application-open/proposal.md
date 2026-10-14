## Why

La orden «usa el computer use y abre firefox» recibió una afirmación de éxito
sin una ventana visible. El resolver y la verificación de aplicaciones sólo
implementan Windows; Linux además utiliza apertura de archivos para ejecutables.

## What Changes

- Resolver nombres de aplicaciones Linux mediante PATH y entradas desktop del sistema.
- Lanzar ejecutables sin shell y entradas desktop mediante GIO.
- Verificar y activar ventanas en X11; en Wayland informar lanzamiento sin afirmar verificación visual.
- Ejecutar solicitudes explícitas de una sola apertura por la herramienta determinista existente y responder desde su resultado.

## Capabilities

### New Capabilities
- `linux-application-open`: apertura determinista con resultado verificable.

## Impact

Servicio main y enrutamiento de chat; sin nuevos canales IPC, dependencias,
secretos ni cambios en permisos. Se conserva el dispatcher y sus guardas.
