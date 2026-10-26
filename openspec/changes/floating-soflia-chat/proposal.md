## Why
El usuario necesita conversar con Soflia sobre la vista actual sin navegar al chat principal ni abrir una ventana del sistema operativo. El panel lateral existente del navegador ocupa toda la altura y no ofrece el compositor flotante solicitado.

## What Changes
- Botón con el icono oficial de Soflia que despliega un compositor compacto y sus respuestas en la aplicación.
- Reutilizar conversación, streaming, modelos, adjuntos, Stop y confirmaciones del chat principal.
- Contexto automático de la vista al enviar, sin franja de controles; navegador mediante observación existente y resto de la app mediante texto visible acotado, sin campos editables.
- Nuevo chat accesible en la cabecera, sin abandonar la vista ni mezclar proyectos; menú de modelos compacto superpuesto sin desplazar el historial.
- Acciones mediante herramientas existentes, solicitadas por el usuario y bajo sus guardas.

## Capabilities
### New Capabilities
- `floating-soflia-chat`: chat contextual compacto en navegador y secciones de la app.
### Modified Capabilities
Ninguna.

## Impact
Renderer y geometría ya existente de la vista web nativa. Sin tablas, migraciones, canales ni herramientas nuevas. La ventana principal alberga todo el panel.
