## Why

La memoria de tareas de escritorio decide propietario con el usuario activo al
recibir el resultado. Publicaciones tardías y colas pueden perder la revisión
que originó la tarea, mezclando resultados con una sesión posterior.

## What Changes

- Ligar publicaciones/respuestas de tareas a identidad, revisión y señal main.
- Marcar procedencia sólo en main con contexto privado y snapshot de aprendizaje.
- Rechazar eventos tardíos/no atribuibles antes de forwarding y guardado.
- Preservar contexto al despachar colas Desktop, BrowserWeb y WindowsUIA.
- Mantener DTO y funcionalidades legítimas sin usar propietario del payload/modelo.

## Capabilities

### New Capabilities
- `desktop-task-publications`: procedencia y vigencia de resultados/eventos aprendidos.

### Modified Capabilities
Ninguna especificación canónica modificada.

## Impact

Entrada de tareas Desktop, publicación EventEmitter, forwarding, tres colas y
guardado de memoria main. Sin canales/dependencias/formato persistente nuevos.
Estado compartido de historiales/perfiles y cancelación física completa siguen
pendientes; este cambio no los declara resueltos.
