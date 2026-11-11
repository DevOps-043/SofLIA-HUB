## Why

La sincronización retira entradas sólo por ID después de esperar red, aunque la
cola y el cache ya contengan otra versión. Además varias llamadas pueden enviar
escrituras simultáneas de la misma identidad y completar en distinto orden.

## What Changes

- Coordinar pasadas por identidad con una activa y una pendiente fusionada,
  conservando filtros y continuidad tras errores.
- Revalidar contenido antes de enviar y reconocer únicamente el contenido aún
  vigente tras esperar; publicar cache sólo después de confirmar esa retirada.
- Conservar prioridad de borrados/lápidas, aislamiento de identidad y manejo de
  rechazo permanente/transitorio; probar cambios y fallos con promesas controladas.

No promete atomicidad entre equipos/ventanas ni revoca peticiones ya enviadas.
No cambia backend, permisos, UI, canales, dependencias o formato persistente.

## Capabilities

### New Capabilities

- `pending-chat-sync-intent`: coordinación local y reconocimiento del contenido pendiente vigente.

### Modified Capabilities

Ninguna especificación de servidor o autorización cambia.

## Impact

Servicios internos renderer de chat, persistencia local y pruebas. La firma
pública de sincronización, DTO, canales main/preload/renderer y esquema remoto
se mantienen. Documentación de cache/sync y evidencia de verificación.
