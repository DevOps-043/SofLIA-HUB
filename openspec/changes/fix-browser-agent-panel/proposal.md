## Why
El navegador montaba el compositor inferior de proyectos y su lanzador, aunque el agente debe desplegarse en el panel lateral.

## What Changes
- Restaurar el chat lateral ajustable y minimizable del navegador, sin franja inferior.
- Limitar el compositor flotante a las secciones de proyectos fuera de su chat.
- Conservar conversaciones, modelo, contexto visible y reapertura por selección externa.

## Capabilities
### New Capabilities
Ninguna.
### Modified Capabilities
- `browser-sidecar-workspace`: presentación lateral exclusiva del chat.

## Impact
Renderer, pruebas y documentación frontend. Sin cambios IPC, permisos o persistencia.
