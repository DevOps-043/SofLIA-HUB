## Why

El coordinador actual ordena escrituras por el ID recibido sin comprobar la
sesión Lia vigente. Una respuesta o un lote pendientes pueden continuar después
de un cambio de identidad, incluso si luego vuelve la misma cuenta.

## What Changes

- Revisar sesión actual y eventos del SDK antes de permitir efectos del lote.
- Vincular trabajo a un ciclo efímero; cierre/cambio revocan solicitudes anteriores
  sin retirar sus datos persistidos ni publicar sus respuestas.
- Conservar una pasada pendiente fusionada sólo dentro del mismo ciclo y liberar
  la suscripción al quedar ocioso. Probar Auth y consumidores con sesiones explícitas.

No cambia RLS, autenticación del proveedor, flujos login/SSO/signOut, formato
local, canales, permisos ni dependencias. No promete cancelar I/O ya enviado.

## Capabilities

### New Capabilities

- `chat-sync-session-review`: vigencia del sujeto y ciclo local del SDK para sincronización pendiente.

### Modified Capabilities

Ninguna especificación de servidor cambia.

## Impact

Coordinador/pasada del chat y revisión privada renderer, fixtures de Auth de
pruebas y documentación. main/preload/renderer conservan contratos; sin SQL,
sesiones reales, tokens persistidos o nuevas APIs privilegiadas.
