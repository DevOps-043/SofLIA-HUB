## Why

Las consultas y mutaciones de claves pueden terminar después de un cambio de
sesión y publicar datos o resultados obsoletos; pueden iniciar una escritura tras
obtener un usuario que ya no está vigente.

## What Changes

- Vigilar cada consulta y mutación mientras está activa.
- Evitar etapas posteriores a un cambio de sesión y descartar resultados tardíos.
- Conservar la invalidación existente y declarar efectos ya enviados inciertos.

## Capabilities
### New Capabilities
- `api-key-session-operations`: vigencia de consulta y mutación por sesión.
### Modified Capabilities
Ninguna.

## Impact
Renderer y pruebas; no cambia RPC, esquemas ni reglas del servidor.
