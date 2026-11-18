## Why

Las salas solo tienen un selector y una distribución automática. Las actividades necesitan instrucciones visibles en la sala y una preparación ajustable por el instructor, partiendo de la propuesta de Architect.

## What Changes

- Panel principal de salas con preparación, revisión de integrantes, asignación manual, nombres y visitas confirmadas.
- Espacio de actividad por sala con instrucciones, personas presentes, entrega personal y acceso al grupo principal.
- Metadatos opcionales de colaboración en prácticas y relación persistida entre salas y actividad.
- Negociación explícita de la ampliación con Learning y conservación de clientes previos.

## Capabilities

### New Capabilities
- `synchronous-room-workspace`: preparación y trabajo en salas por actividad.

### Modified Capabilities

## Impact

Renderer Learning Live, transporte Studio existente y contrato/dominio/API canónicos de Learning. No agrega dependencias, canales IPC ni tablas. Architect podrá enviar los metadatos definidos; su productor se mantiene fuera de este cambio.
