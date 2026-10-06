## Why

Organizar archivos solicita aprobación repetida para movimientos reversibles. Una tarea con varias extensiones consume llamadas innecesarias y el chat puede agotar su presupuesto sin procesar o solicitar un cierre final.

## What Changes

- Quitar confirmación de organize_files y batch_move_files en el chat local.
- Añadir Siempre permitir para el mismo comando local, acotado por usuario, herramienta y carpeta; mantener HITL por ejecución para cambios sensibles del sistema.
- Corregir fallback nativo que aprobaba sin ventana y validar su payload.
- Permitir batch_move_files con group_by_extension para mover y clasificar en un lote por origen, manteniendo manifiestos y colisiones.
- Reservar una respuesta final sin herramientas al agotar el presupuesto, sin aumentar tandas de ejecución.

## Capabilities

### New Capabilities
- `scoped-command-approvals`: aprobaciones locales acotadas y cierre verificable de organización de archivos.

### Modified Capabilities

Ninguna.

## Impact

Chat React, servicio de confirmación, canal computer:confirm-action, preload, batch-file-ops y loops de ambos proveedores. Sin dependencias, cambios de secretos, permisos remotos ni migraciones.
