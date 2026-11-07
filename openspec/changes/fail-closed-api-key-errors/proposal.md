## Why

Errores RPC se tratan como ausencia de clave, habilitando un fallback de entorno;
los mensajes de base pueden exponer detalles. Una implementación duplicada no
aplica la invalidación de lecturas. La validación incluye la clave en la URL.

## What Changes

- Distinguir RPC fallido de resultado vacío y rechazar respuestas inválidas.
- Sanear errores de consultas y mutaciones; unificar el módulo compatible.
- Enviar la clave de validación Google en cabecera, con pruebas sin red.

## Capabilities
### New Capabilities
- `api-key-error-privacy`: errores seguros y semántica de ausencia de clave.
### Modified Capabilities
Ninguna.

## Impact
Renderer y pruebas. No migra las claves a main ni altera RLS o tablas.
