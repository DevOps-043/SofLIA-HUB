# Compilación y estabilidad de respaldos

## Why

Cada typecheck reinstala Zoom. La línea base de TypeScript procesa 3951882 líneas de declaraciones y consume 3201973 K de memoria. Los respaldos mensuales exceden el rango de temporizadores Node, pudiendo dispararse cada milisegundo.

## What Changes

- Verificar instalación Zoom antes de recurrir a npm ci; mantener reinstalación explícita.
- Activar cachés TypeScript independientes y excluir salidas/worktrees del watcher.
- Cargar sólo cinco servicios Google mediante una fachada tipada, y diferir ajustes/productividad.
- Programar respaldos por fecha con esperas acotadas y exclusión de solapamiento.

## Capabilities

### New Capabilities
- `build-resource-efficiency`: preparación y compilación reutilizable, con respaldos acotados.

### Modified Capabilities

Ninguna API pública cambia.

## Impact

Tooling local, imports del proceso main y sus mocks, dos superficies React y scheduler interno. No cambia permisos ni persistencia.
