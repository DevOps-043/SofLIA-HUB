## Why

Los equipos de la Orbe comparten el pipeline del chat, pero no aparecen en el monitor: falta el propietario del turno y el publicador IPC solo autoriza al Hub. Completar esa ruta permite observar los especialistas al usar voz.

## What Changes

- Publicar actividad desde el frame principal de la Orbe registrada por main.
- Separar origen e identificación de equipos de Hub y Orbe; etiquetar la superficie en main.
- Conservar limpieza por sesión, validación cerrada y preload existente.
- Ampliar la investigación estática de Codex con referencias a un commit verificable.

No objetivos: nuevos permisos, modelos, herramientas, canales IPC, inferencias reales ni delegación recursiva.

## Capabilities

### New Capabilities

- `orb-agent-activity`: observación de equipos de la Orbe con identidad y origen comprobados.

### Modified Capabilities

Ninguna especificación vigente se modifica.

## Impact

Servicio de actividad main, inicialización del runtime, contrato compartido, hook de conversación de la Orbe, etiqueta del monitor y pruebas. Sin dependencias, migraciones ni cambios en empaquetado o HITL.
