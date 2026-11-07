## Why
Una caché global comparte una clave entre proveedores y sesiones y no se
invalida al actualizar credenciales. Una respuesta tardía puede cruzar cuentas.

## What Changes
- Eliminar la caché global de claves y verificar eventos de sesión por consulta.
- Invalidar consultas en curso durante mutaciones de claves.
- Conservar la fachada y el fallback existente; probar con puertos simulados.

## Capabilities
### New Capabilities
- `renderer-api-key-lifetime`: vigencia de claves por consulta y sesión.
### Modified Capabilities
Ninguna.

## Impact
Renderer y sus pruebas. No cambia RPC, RLS ni traslada Gemini a main.
