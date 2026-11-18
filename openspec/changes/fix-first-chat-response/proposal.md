## Why

El primer mensaje de un chat queda sin respuesta: guardar la conversación cambia
la clave del proveedor del visor, remonta todo el workspace y aborta el turno.
Las pruebas de hooks aislados no cubrían ese ancestro del chat.

## What Changes

- Conservar el árbol del chat durante el primer guardado usando el ámbito estable
  que ya reserva el gestor, también para el proveedor del visor.
- Cubrir respuesta, error y cancelación por cambio real de chat o identidad
  dentro del árbol de AppContent.
- Documentar el ciclo de vida del contenedor y la evidencia reproducible.

## Capabilities

### New Capabilities
- `first-chat-response`: continuidad del primer turno al persistir el borrador.

### Modified Capabilities
Ninguna.

## Impact

Renderer React y pruebas de integración locales. Sin cambios en modelos,
credenciales, IPC, persistencia, dependencias ni permisos runtime.
