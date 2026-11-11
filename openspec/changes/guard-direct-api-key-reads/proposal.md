## Why

La lectura directa exportada y su fachada histórica no aplicaban la revisión de
sesión o de mutación que sí tenía la fachada con nombre de caché.

## What Changes

- Aplicar una sola guarda compartida a toda lectura pública de credenciales.
- Revocar lecturas pendientes por cambio de sesión o mutación local.
- Conservar contratos de ausencia, errores y fachadas existentes.

## Capabilities
### New Capabilities
- `direct-api-key-lifetime`: vigencia de todas las lecturas públicas de claves.
### Modified Capabilities
Ninguna.

## Impact
Renderer y pruebas. No cambia RPC, RLS, SDK ni exposición de Gemini en renderer.
