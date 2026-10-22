## Why

Se retira la integración existente de Project Hub/IRIS para preparar una futura implementación desde cero.

## What Changes

- Retirar vistas externas, cliente REST, autenticación federada, IPC y herramientas IRIS del chat y WhatsApp.
- Retirar publicación de acciones de reuniones y selecciones externas; conservar análisis y revisión local.
- Separar identidad SOFIA reutilizada por otras funciones antes de eliminar IRIS.
- Desacoplar arranque y accesos del navegador de Project Hub.

## Capabilities

### New Capabilities
- `project-hub-retirement`: retirada completa y preservación de carpetas y datos.

## Impact

Solo código y documentación de Soflia Hub. No se modifica el repositorio Project Hub ni se ejecutan migraciones o borrados de datos. Las carpetas, chats, fuentes y minutas existentes se conservan.
