## Why

Crear un proyecto muestra un formulario estrecho dentro del lateral y permite seleccionar un workspace ajeno a la organización activa. Tampoco permite configurar su ubicación ni vincular carpetas de trabajo.

## What Changes

- Reemplazar el formulario por un diálogo modal en la ventana principal, fuera del árbol del lateral.
- Asignar automáticamente el workspace mediante la relación exacta `workspaces.sofia_org_id` y limitar la lista a esa organización.
- Seleccionar carpeta principal y hasta diez carpetas adicionales con el explorador nativo del sistema.
- Ofrecer almacenamiento local, Google Drive o OneDrive de la cuenta vinculada, sin bloque visible de organización ni almacenamiento de archivos en Soflia.
- Separar la autorización de archivos de OneDrive del calendario, con cuenta comprobada, PKCE y caché cifrada.
- Guardar los archivos nuevos directamente en la ubicación elegida y conservar como referencias los recursos históricos.
- Persistir ubicación cifrada por usuario/proyecto y un recibo por operación para impedir reenvíos de creación incierta.
- Conservar la superficie web nativa oculta mientras el diálogo está abierto y restaurarla al cerrar.

## Capabilities

### New Capabilities
- `project-creation-dialog`: creación contextual, selector interno y ubicación privada persistida.
- `direct-project-database`: acceso directo a IRIS con identidad y organización de Learning, sin dependencia de la API web.

### Modified Capabilities

Ninguna.

## Impact

Actualización por instrucción del usuario: el Hub debe acceder directamente a IRIS/Supabase desde main, reutilizando su conexión existente y la sesión verificada de SOFIA. La API web y su canje dejan de ser dependencias del flujo de proyectos en producción. Se conserva la fachada IPC y sus contratos, con validación de organización, membresía y actor en cada operación. El parche del servidor preparado anteriormente queda fuera del camino de entrega.

Renderer, servicios de creación/almacenamiento main, handlers, allowlist y preload; autorización delegada de OneDrive y clientes de archivos Google/Microsoft. La lectura de directorio IRIS sólo devuelve un workspace autorizado; no modifica permisos ni amplía acceso directo a negocio. Tras la aclaración del usuario, el alcance incluye corregir en el repositorio Project Hub la precondición incorrecta de equipos: el proyecto pertenece al workspace de su organización y `team_id` puede quedar nulo según su esquema vigente. No requiere migración; sí publicar el ajuste de la API para activarlo. No implementa sincronización offline ni la portabilidad completa del plan previo.
