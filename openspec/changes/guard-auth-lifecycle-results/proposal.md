## Why

La restauración inicial y los callbacks Auth esperan I/O sin comprobar que sigan vigentes. Un resultado anterior puede restaurar estado después del cierre, negar una sesión nueva o continuar el canje de Lia tras un cambio de identidad.

## What Changes

- Suscribir antes de restaurar y cancelar la operación anterior al observar otro evento o desmontar.
- Revisar vigencia tras cada espera antes de publicar usuario/contexto/sesión o iniciar otro efecto.
- Propagar una señal opcional hasta la recuperación y el canje Lia, incluyendo esperas de reintento.
- Reproducir concurrencia y conservar evidencia, documentación e inventario.
- No se arbitran aquí todos los intentos explícitos de acceso/SSO, ni se promete revertir I/O enviado o sustituir RLS/JWT.

## Capabilities

### New Capabilities

- `auth-lifecycle-cancellation`: vigencia y liberación de operaciones de restauración/eventos Auth y continuaciones Lia.

### Modified Capabilities

Ninguna.

## Impact

Hooks privados de Auth y servicio de canje Lia, con AbortSignal opcional compatible. Sin dependencias, almacenamiento, SQL, IPC ni UI nuevos. Se mantiene la rama acumulativa y la separación de capas. Ver [contexto](context-pack.md).
