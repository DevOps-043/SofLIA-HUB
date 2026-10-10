# Abrir sesiones de Learning en Soflia Hub

## Why

La decisión de producto traslada las sesiones síncronas al Hub de escritorio. Learning conserva administración, permisos y catálogo. El alumno abre una sesión desde su tarjeta y el Hub obtiene acceso autenticado a esa reunión o webinar.

## What Changes

- Nuevo protocolo `soflia://learning-session?organization_slug=<slug>&session_id=<uuid>` sin credenciales ni destinos externos.
- Retención de la solicitud durante arranque y autenticación.
- Consulta de acceso desde main al origen Learning configurado, usando la sesión SOFIA validada.
- Apertura de la URL Zoom autorizada en el navegador integrado de Hub.
- Learning elimina su aula embebida y APIs de interacción en vivo; conserva programación y lifecycle REST.

## Capabilities

### New Capabilities

- `learning-live-session-launch`: apertura autenticada de una reunión o webinar académico desde Learning.

## Impact

Cambios en protocolo, main, preload, wrapper renderer y orquestación de AppContent. No se añaden dependencias ni se ejecutan migraciones remotas. El inicio PKCE existente conserva su contrato. La conexión multimedia usa el cliente web Zoom en el navegador integrado; no implica nueva UI educativa ni captura automática.
