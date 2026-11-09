## Why

La investigación Electron resuelve claves de Gemini en el renderer y las cruza por IPC.

## What Changes

Resolver credenciales en main bajo la autoridad Gemini vigente y dentro de la
cuota de investigación. Revocar el trabajo y los reintentos al cambiar sesión.
Mantener navegador independiente, fuentes, gráficas y herramientas admitidas.

## Capabilities

### New Capabilities
- `native-grounding-credentials`: custodia nativa para investigación con fuentes.

### Modified Capabilities
Ninguna.

## Impact

Contrato existente main, preload y wrapper. El chat general y la fase de acciones
locales conservan su propia ruta de inferencia. Sin migración de datos.
