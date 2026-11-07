## Why

Las rutas antiguas permiten evitar controles de channels. WhatsApp está
duplicado entre el registro activo de startup y un handler no usado; eventos
globales se publican sin verificar receptor. La UI guarda una clave al abrir y
asume éxito en varias mutaciones, incompatible con HITL y errores reales.

## What Changes

- Gateway común para los 25 contratos sin ampliar canales o permisos.
- SOFIA/main deciden actor/rol; schemas cerrados y confirmación crítica.
- Una implementación canónica por proveedor, eventos autorizados sin duplicación.
- DTO compartido y resultados/cancelaciones respetados por el hook.
- El historial físico sigue siendo administración de este dispositivo, sin
  atribuir ownership organizacional no demostrado.

## Capabilities

### New Capabilities
- `legacy-channel-authority`: autoridad y compatibilidad de APIs/eventos de proveedores.

### Modified Capabilities

Ninguna especificación vigente reemplazada.

## Impact

Handlers, gateway, servicio, arranque, preload y renderer. Sin dependencias,
modelos, SQL, despliegue o cuentas reales. Las conexiones físicas compartidas
conservan trabajo de aislamiento/custodia posterior.
