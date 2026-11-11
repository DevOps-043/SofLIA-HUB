## Why
El consentimiento global puede sobrevivir al cambio de cuenta y una consulta de
clave tardía permite iniciar una transferencia después de revocar autorización.

## What Changes
Vincular consentimiento a sesión y validar la misma aprobación antes de enviar
y publicar la subida. Una aprobación nueva no habilita una operación anterior.

## Capabilities
### New Capabilities
- `media-session-consent`: autorización de transferencias vinculada a sesión.
### Modified Capabilities
Ninguna.

## Impact
Wrapper renderer y pruebas. No migra resolución de claves a main ni revierte
transferencias enviadas. La revisión independiente queda pendiente.
