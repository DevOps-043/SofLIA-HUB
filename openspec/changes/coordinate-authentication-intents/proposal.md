## Why

Login, retorno SSO, reintentos y cierre escriben el mismo estado sin compartir ownership. Las guardas de restauración/eventos no evitan que esos productores republiquen identidad, cierren una cuenta nueva o continúen un canje después de cancelarse.

## What Changes

- Coordinar intenciones por proveedor y ordenar mutaciones SDK, invalidando continuaciones antes de esperar red.
- Propagar cancelación por login/SSO, directorio y recuperación Lia, conservando los consumidores existentes.
- Hacer que SDK/eventos propios de un intento se reconcilien sin cancelar su propio login; cerrar ante eventos de revocación y resultados incompatibles.
- Revocar publicación main sin esperar lecturas de sesión, manteniendo el contrato IPC existente.
- Verificar carreras integradas, errores, recursos y compatibilidad, con evidencia y límites explícitos.

## Capabilities

### New Capabilities

- `authentication-intent-ownership`: prevalencia de intención y sesión observada dentro de un AuthProvider, incluyendo efectos y publicación.

### Modified Capabilities

Ninguna. La cancelación local de restauración se mantiene e integra en el ownership común.

## Impact

Hooks Auth, servicios SOFIA/SSO y utilidades privadas de cancelación. API pública de AuthContext, DTO, main/preload/renderer y almacenamiento compatibles. Sin dependencias ni SQL. I/O enviado, sincronización entre ventanas/equipos y autorización del servidor conservan contratos propios; ver [contexto](context-pack.md).
