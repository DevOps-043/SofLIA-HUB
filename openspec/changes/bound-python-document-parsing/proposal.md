## Why

La frontera main rechaza salidas grandes después de que Python ya acumuló el documento. Office permite expansión de contenedores sin presupuesto y la ruta de truncado puede producir una respuesta que su propio consumidor rechaza.

## What Changes

- Prevalidar Office ZIP/XML con cuotas explícitas, sin extraer archivos ni aceptar DTD/entidades.
- Construir texto/tablas con presupuesto incremental alineado con el DTO, incluyendo unidades UTF-16 y coste de Markdown.
- Leer desde descriptor estable, cerrar libros ante fallos y proyectar DOC_RESOURCE_LIMIT con mensaje controlado.
- Mantener lecturas normales, privacidad y APIs; rechazar excesos explícitamente en lugar de devolver datos parciales no declarados.
- Añadir pruebas Python reproducibles de recursos/formatos/stdio y evidencia de integración TS/build.

## Capabilities

### New Capabilities

- `python-document-resource-budget`: admisión de contenedores y construcción acotada del resultado documental.

### Modified Capabilities

Ninguna especificación vigente se modifica por nombre.

## Impact

python/tools_sidecar, catálogo de errores main, pruebas y documentación. Sin dependencias, permisos, canales, SQL ni cambios de protocolo. No certifica parsers ni contiene recursos a nivel del SO. Conserva las dieciocho unidades anteriores.
