## Why
La agenda dedica demasiado espacio a decoración y expone sesiones vencidas porque upcoming solo comprueba el estado. Falta adaptar navegación y acceso a gestión/historial al permiso académico confirmado.

## What Changes
- Vista compacta con tipografía, tarjetas sobrias, fechas y acciones claras; sin orbes decorativos ni mensajes promocionales.
- Separar consulta, política visual y tarjetas; reiniciar estado al cambiar organización y descartar respuestas tardías.
- Capacidades negociadas para distinguir perfiles y habilitar historial/gestión; alumnos solo próximas asignadas.
- Reutilizar la gestión existente de Learning, abierta por acción explícita en el navegador integrado, y el aula de Hub.
- Filtrar vencimiento antes de contar y paginar; migración incremental reentrante en la fuente Learning.

## Capabilities
### New Capabilities
- `live-agenda-experience`: agenda por permisos y presentación mínima.
### Modified Capabilities
Ninguna.

## Impact
Renderer, servicio main del catálogo, contrato compartido, endpoint y SQL Learning. Sin canales nuevos, dependencias, credenciales, cambios de tablas ni ejecución remota.
