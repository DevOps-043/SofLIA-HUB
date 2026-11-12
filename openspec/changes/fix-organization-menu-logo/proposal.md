## Why
El menú usa únicamente `brand_favicon_url`, aunque el contrato también contiene `logo_url`. Las organizaciones sin favicon muestran iniciales o la foto personal. Los marcos y recortes circulares reducen la legibilidad de logos altos y horizontales.

## What Changes
- Mostrar imagen y nombre de la organización activa en el botón del menú expandido, sin flecha y con nombre accesible en modo compacto.
- Diferenciar el pie del menú de la lista de chats sólo con separador superior, manteniendo el fondo transparente y sin enmarcar el logo.
- Preferir el logo y recurrir al favicon si falta o falla; usar la inicial de la organización cuando ninguna imagen carga.
- Ajustar imágenes completas y proporcionales, sin fondo, borde, sombra ni recorte añadido.
- Conservar nombres en el selector, selección de organización, configuración, apariencia y cierre de sesión.

## Capabilities
### New Capabilities
- `organization-menu-branding`: identidad de organización en el acceso y selector del menú.

### Modified Capabilities
Ninguna.

## Impact
Renderer y documentación visual. Sin cambios de persistencia, IPC, permisos ni dependencias. No se modifican los archivos de imagen originales.
