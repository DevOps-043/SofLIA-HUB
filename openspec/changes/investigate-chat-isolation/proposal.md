## Why

La auditoría reprodujo asociación de presentaciones al chat equivocado, pérdidas del primer guardado y turnos que eluden cancelación. Las presentaciones con Skill activa dependen del renderer y se interrumpen al navegar. El usuario autorizó corregir los ocho hallazgos y verificar aislamiento, continuidad y conservación.

## What Changes

- Identidad estable de borrador/conversación y cola de guardado por destino, con persistencia local anterior a inferencia.
- Skill y panel ligados al origen, sin enlaces deducidos de null → id ni publicaciones tardías.
- Presentaciones de Skill ejecutadas por equipos main con workspace fijo y verificación de deck.json.
- Entrada única de turnos, memoria conversacional aislada y procedencia visible en el monitor.
- Pruebas de regresión y navegación A/B/A, fallos de almacenamiento, cancelación y autorización.

## Capabilities

### New Capabilities
- `chat-context-isolation`: conservación del origen de mensajes, tareas y recursos al navegar.

### Modified Capabilities

Ninguna especificación vigente se sustituye; se extiende el comportamiento de equipos locales y del chat.

## Impact

Renderer React, servicio de chat/cache, memoria SQLite y contratos existentes de background-teams/agent-activity. Sin migración remota, nuevos permisos runtime ni efectos externos. La ejecución continúa al cambiar chat mientras main y la sesión siguen vivos; cerrar la aplicación conserva recuperación explícita.
