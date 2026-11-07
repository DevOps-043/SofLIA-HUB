## Why
Archivos fragmenta la misma colección en tres paneles y exige pegar enlaces de Drive. Páginas web no ofrece guardar desde el navegador. Chats depende de un vínculo federado que puede no existir en proyectos creados directamente.

## What Changes
- Retirar las acciones globales Añadir colaborador/Añadir tarea del encabezado.
- Una cuadrícula de archivos locales, de proveedor y referencias existentes, con una búsqueda, Añadir archivo y Vincular Drive juntos y vista previa dentro de la aplicación.
- Selector de Drive con navegación/paginación y datos del proveedor; no pide título/URL.
- Lista de páginas guardadas y acción del navegador que usa el proyecto activo automáticamente; fuera de un proyecto permite elegir el destino. El listado directo incluye los roles efectivos para que el selector no oculte proyectos propios.
- Recuperar el vínculo de chat existente y preparar un espacio personal persistente cuando no existe, sin conceder acceso compartido ni mezclar organizaciones. Lista de chats y reutilización del chat principal, con flecha de regreso junto al modelo.

## Capabilities
### New Capabilities
- `project-resources`: colección unificada, selector y vista previa.
- `project-chat-navigation`: acceso y retorno al chat del proyecto.

### Modified Capabilities
Ninguna.

## Impact
Renderer, contratos IPC de listado/selección de nube y lectura acotada de archivos del proyecto. El usuario autorizó el 2026-10-24 corregir desde la base el fallo de guardado: una función de lectura propia en Learning verifica la membresía y el verificador de IRIS establece el ámbito de cada petición para aplicar RLS en autoridades, evidencias y documentos. Se habilita la extensión oficial HTTP de Postgres; no se crean secretos, cuentas ni nuevas dependencias del paquete de la aplicación.
