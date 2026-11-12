## Why
Los administradores necesitan editar datos básicos e identidad visual de su organización desde Ajustes. El acceso inferior debe conservar el aspecto flotante: imagen y nombre mayor, sin flecha ni fondo distinto, separado únicamente por una línea.

## What Changes
- Añadir Organización en Ajustes para propietarios y administradores activos.
- Editar nombre, descripción, contacto, web, logo, icono y dos colores; previsualizar imágenes y guardar explícitamente.
- Autorizar lecturas y escrituras mediante una RPC limitada a campos de presentación, sin abrir UPDATE directo de organizations.
- Preparar almacenamiento público de imágenes con escritura acotada por membresía administrativa y organización.
- Actualizar la identidad del menú después de guardar sin reiniciar ni cambiar de organización.

## Capabilities
### New Capabilities
- `organization-settings`: administración básica e identidad visual.
### Modified Capabilities
Ninguna.

## Impact
Renderer, servicio SOFIA, contexto de autenticación y migración aditiva en SOFIA Learning. Sin canales IPC ni permisos runtime nuevos. La migración remota requiere autorización explícita y no se aplica durante la implementación.
