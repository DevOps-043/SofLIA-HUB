## Why
El estudio del instructor conserva controles simulados y no permite probar colaboración real. Engine será el origen del contenido preparado y Zoom seguirá siendo el proveedor audiovisual.

## What Changes
- Persistir chat, moderación, escenas, salas académicas, quizzes, prácticas y reloj en Learning con autorización por sesión e idempotencia.
- Suscribir Hub a invalidaciones Realtime autenticadas y recuperar snapshots autorizados sin exponer credenciales.
- Integrar Meeting SDK con firma de servidor, rol derivado y ZAK del anfitrión; separar captura local y reunión conectada.
- Definir un manifiesto versionado para importar contenido preparado desde Engine sin acoplar sus tablas internas.
- Sustituir datos simulados en producción por estado remoto y capacidades explícitas.
- Sustituir el cuadro nativo de compartir por un selector propio con miniaturas, categorías, búsqueda y consentimiento explícito.
- Crear escenas locales de producción sin confirmación de Learning y vincular sus fuentes reales al flujo de Compartir.

## Capabilities
### New Capabilities
- `live-studio-runtime`: colaboración persistente y conexión audiovisual del estudio.
- `display-media-picker`: selección local y segura de pantallas, ventanas y pestañas del navegador del Hub.
- `studio-local-scenes`: banco local de producción y concesiones efímeras de fuentes concretas.

## Impact
Hub renderer/main/preload, backend y migración SOFIA de Learning. No se alteran secretos ni se ejecutan migraciones o despliegues remotos. Engine requiere adoptar el contrato de publicación, sin asumir que sus escenas de producción audiovisual sean escenas de una clase.
