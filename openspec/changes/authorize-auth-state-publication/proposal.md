## Why

auth:set-state y auth:get-state no comprueban emisor/frame/documento. Un origen con acceso al puente puede publicar o consultar el estado del proceso main; la regla de Orbe consumidor sólo está aplicada en el renderer. El payload admite tipos de token inválidos como ausencia y carece de cuotas.

## What Changes

- Autorizar en main publicación sólo desde Hub y lectura desde Hub/Orbe registrados, sin requerir sesión previa al bootstrap.
- Separar fuente nativa/documento de la guarda de sesión existente y componer ambas para consumidores protegidos, sin ampliar permisos.
- Definir DTO compartido con límites, pares de tokens y respuesta observable mínima; mantener canales/preload/wrapper.
- Revalidar fuente al volver de esperas, conservar revisión de publicación y liberar listeners; denegar sin efectos ni filtrar identidad/credenciales.
- Probar regresiones, cuatro capas y consumidores de la guarda compartida; documentar límites de I/O ya enviado y servicios main aún no rediseñados.

## Capabilities

### New Capabilities

- `auth-state-source-authorization`: roles de ventanas y fuente vigente para publicación/lectura Auth y contrato acotado.

### Modified Capabilities

Ninguna.

## Impact

Handler y registro bootstrap, servicios de estado/sesión existentes, fuente IPC compartida, tipos DTO/preload/wrapper y pruebas. Sin canales, dependencias o almacenamiento nuevos. No cambia verificación de identidad del servidor ni comportamiento legacy sin SOFIA. [Contexto](context-pack.md).
