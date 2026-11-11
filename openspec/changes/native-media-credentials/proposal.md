## Why
Las subidas de medios ya se ejecutan en main pero reciben la clave desde renderer.

## What Changes
Resolver Google en main mediante autoridad nativa; eliminar claves de preload y
wrapper y comprobar ventana, sesión y vigencia antes de iniciar transferencia.

## Capabilities
### New Capabilities
- `native-media-credentials`: credenciales de medios exclusivamente en main.
### Modified Capabilities
Ninguna.

## Impact
Handlers, preload y wrapper; conserva canales. Las rutas locales y transferencias
remotas conservan controles propios. Otros flujos Gemini siguen en renderer.
