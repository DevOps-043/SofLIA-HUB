## Why

Los especialistas trabajan en paralelo pero sólo existe un indicador genérico. El usuario necesita una ventana adicional para observar su actividad sin perder la tarea principal.

## What Changes

- Ventana nativa compacta con equipos recientes, roles, estados y duración.
- Apertura automática sin robar foco, minimizar y ocultar sin cancelar trabajo.
- Eventos por especialista y snapshots en memoria, sin transcripciones ni resultados.
- Puente tipado, validación de IPC y limpieza al cambiar sesión.

## Capabilities

### New Capabilities
- `agent-activity-window`: monitor de actividad multiagente del producto.

### Modified Capabilities
Ninguna.

## Impact

Runner compartido, servicio Electron, preload limitado y vista React dedicada.
Sin cambios de permisos del agente, credenciales, migraciones o dependencias.
No objetivos: editar instrucciones, aprobar efectos o cancelar trabajos desde el monitor.
