## Why

Los bucles web/UIA comprueban cancelación al empezar el paso, pero pueden actuar
después de esperar al modelo. Un fallo al emitir inicio o finalizar artefactos
también puede dejar el backend ocupado y bloquear su cola.

## What Changes

- Revalidar señales entre etapas asíncronas y antes de efectos/fallbacks.
- Propagar cancelación a decisiones y ejecutores compuestos sin serializar señales.
- Garantizar limpieza ante fallos de inicio/finalización y conservar la reserva de cola.
- Sustituir tipos any de las funciones intervenidas por contratos del servicio/SDK.

## Capabilities

### New Capabilities
- `backend-task-cancellation`: vigencia entre etapas y liberación de recursos web/UIA.

### Modified Capabilities
Ninguna especificación canónica modificada.

## Impact

Servicios, bucles, modelo, ejecutores y pruebas BrowserWeb/WindowsUIA.
Sin canales, permisos, dependencias, formatos persistentes o políticas de modelos
nuevos. No acredita reversión de I/O ni aislamiento global de perfiles/historiales.
