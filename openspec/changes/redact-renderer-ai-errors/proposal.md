## Why

Los errores de IA pueden contener claves, texto o rutas privadas y se registraban
completos o se mostraban al usuario en los flujos de imagen, Flow, chat y dictado.

## What Changes

- Sustituir detalles brutos por mensajes públicos controlados en las rutas revisadas.
- Conservar reintentos, respuestas de fallback y clasificación de errores.
- Probar con credenciales y contenido ficticios; documentar los límites.

## Capabilities

### New Capabilities
- `renderer-ai-error-privacy`: privacidad de errores en los flujos revisados.

### Modified Capabilities

Ninguna.

## Impact

Renderer, pruebas y documentación. No mueve claves a main ni garantiza que
otros registros del producto estén saneados.
