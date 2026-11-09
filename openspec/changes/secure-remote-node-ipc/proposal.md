## Why

Los 13 canales Remote Node invocan servicios sin comprobar emisor, sesión ni schemas y permiten acciones remotas sin confirmación nativa. El cliente HTTP no tiene plazo ni límite de respuesta y puede actualizar metadata después de una sesión invalidada.

## What Changes

- Validar contratos y cuotas por operación, manteniendo canales y argumentos válidos.
- Exigir fuente Hub/Orbe registrada e identidad vigente antes y después de esperas.
- **BREAKING de seguridad:** exigir aprobación nativa para mutaciones, ejecución, cierre de proceso y captura; entradas extra/malformadas se rechazan.
- Vincular la revisión a la configuración main y comprobarla al admitir transporte; abortar esperas ante revocación y acotar HTTP.
- Errores fijos sin datos privados, resultado incierto tras posibles efectos y pruebas integradas de las cuatro capas.

## Capabilities

### New Capabilities

- `remote-node-ipc-authorization`: autorización, validación, revisión y límites del recorrido nativo de nodos remotos.

### Modified Capabilities

Ninguna.

## Impact

Contratos Remote Node, handlers, servicio/cliente HTTP, arranque, preload/wrappers, pruebas y documentación. Sin canales ni dependencias nuevas. Custodia cifrada, ownership global y otras rutas de automatización siguen pendientes; no se ejecutarán acciones/red/cuentas reales.
