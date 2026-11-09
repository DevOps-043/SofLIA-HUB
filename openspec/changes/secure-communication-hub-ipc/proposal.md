## Why

Los diez handlers aceptan actor del renderer y no verifican fuente. El servicio
resuelve ese ID en SOFIA y publica historial global: un cliente puede seleccionar
otra identidad y obtener permisos ajenos.

## What Changes

- Derivar actor en main, conservar hints compatibles sólo si coinciden.
- Validar inputs cerrados y snapshots; confirmar cambios críticos en ventana nativa.
- Revalidar sesión/organización antes de efectos y después de esperas.
- Acotar identidades/historial local; no atribuir historial físico sin ownership.
- Tipar las cuatro capas sin nuevos canales o dependencias.
- Rechazar coerción String(array) en enums; el mismo fallo reproducido en el
  contrato OpenAI se corrige con la validación JSON compartida.

## Capabilities

### New Capabilities
- `communication-hub-authority`: autoridad, recursos y aprobación de los contratos channels.

### Modified Capabilities

Ninguna especificación vigente se reemplaza.

## Impact

Servicio/handlers, preload, wrapper compartido, startup y documentación. Sin SQL,
cuentas, secretos, mensajería real o cambio de los agentes runtime durante QA.
Custodia global de transportes y sus otras APIs permanece pendiente.
