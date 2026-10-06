## Why

El monitor «Equipo de SofLIA» se abría como ventana nativa aparte. Fuera de la
aplicación se perdía el contexto y, en el navegador integrado, su botón flotante
fijo tapaba los controles de vista de la barra de pestañas. Además, los márgenes
del chat flotante del navegador restaban espacio útil a la página.

## What Changes

- Sustituir la ventana nativa por un panel acoplado dentro del Hub y del
  navegador integrado. Se elimina `electron/agent-activity/window.ts`.
- Mover el acceso «Ver equipos de agentes» a la barra de título del Hub y a la
  barra de pestañas del navegador, sin posición fija sobre otros controles.
- Retirar el canal `agent-activity:control`, la entrada `?view=agent-activity`
  y el preload restringido de la ventana auxiliar.
- Reducir de 12 a 6 px el margen y la separación del chat flotante del
  navegador, y su radio de 1.75 a 1.25 rem.

## Capabilities

### New Capabilities
- `agent-activity-panel`: monitor de equipos acoplado en la ventana principal.

### Modified Capabilities
Ninguna. Reemplaza el diseño de presentación de `show-agent-activity-window`
(ventana auxiliar) sin cambiar sus eventos, datos mínimos ni aislamiento.

## Impact

Renderer (`src/components/agents/`, `AppContent`, `AppTitleBar`, barra y layout
del navegador), servicio de actividad en main, preload y allowlist IPC. Sin
dependencias, migraciones, permisos de agentes ni cambios de credenciales.

No objetivos: cancelar o aprobar trabajo desde el panel, persistir el estado de
apertura entre sesiones o rediseñar el contenido de las tarjetas.
