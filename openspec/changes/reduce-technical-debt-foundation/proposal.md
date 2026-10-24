## Why

El diagnóstico del 19 de octubre identifica verificación no reproducible, publicación con builds divergentes y autorización desigual del calendario. Se comienza con una unidad verificable que conserva los módulos y permite abordar el resto por contratos.

## What Changes

- Fijar raíz de ESLint y excluir checkouts anidados; rechazar errores fatales incluso cuando aparecen también en HEAD.
- Ejecutar el gate antes de publicar el mismo commit, alinear Node 24 y usar build:linux completo.
- Tipar calendario, validar actor/marco/payload, confirmar mutaciones en main, sanear errores y retirar secretos de eventos.
- Corregir consumo de respuestas del calendario y documentar SQLite nativo.
- Registrar plan por áreas y evidencia real, sin declarar porcentaje nuevo sin una reevaluación.

## Capabilities

### New Capabilities
- technical-debt-foundation: verificación y publicación coherentes.
- calendar-ipc-boundary: calendario tipado y autorización contextual.

### Modified Capabilities
Ninguna especificación principal existente cambia.

## Impact

Afecta ESLint, scripts de calidad, workflows, servicio/handler/preload/wrapper/UI de calendario y documentación. No agrega tablas, dependencias ni canales IPC; no despliega ni modifica secretos. La confirmación nativa es deliberadamente obligatoria en mutaciones externas.
