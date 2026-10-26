## Why

El formulario actual se expande sobre el tablero, carece de inicio y recursos en la creación y no permite elegir fases si el equipo no tiene estados.

## What Changes

- Ventana modal con detalles, planificación y recursos por URL, con acciones visibles y diseño adaptable.
- Selector alineado con las siete fases del tablero y estados personalizados. Las fases ausentes se crean sólo al guardar y con permisos administrativos de equipo/workspace.
- Inicio en started_at y referencias clasificadas en external_links, campos ya existentes de task_issues.
- Validación de fechas, protocolo y credenciales de URL, límites y saneamiento de parámetros sensibles.

## Capabilities

### New Capabilities
- `task-editor`: creación y edición modal con planificación y recursos.

### Modified Capabilities

Ninguna.

## Impact

Renderer, contratos de createTask/updateTask y backend directo IRIS. Sin nuevos canales IPC, dependencias, migraciones ni envío de mensajes. Reutiliza servicio, handler, preload y wrapper existentes y sus confirmaciones.
