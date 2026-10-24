## Why

El selector compartido mantiene foco activo como índice: cambiar/reordenar opciones puede anunciar o confirmar otra opción. Falta búsqueda por texto, Escape puede propagarse al diálogo, la lista pierde la etiqueta externa y el menú no cierra por un cambio de foco programático. La accesibilidad requiere comportamiento verificable además de roles presentes.

## What Changes

- Mantener identidad activa por valor y derivar una opción habilitada válida.
- Completar prefijos y ciclos de caracteres, cierre/foco y etiquetas sin cambiar props/onChange.
- Respetar movimiento reducido en el popup y comprobar geometría a 200% con Chromium temporal.
- Registrar metadatos IRIS verificados y límites de su remediación como seguimiento documental del diagnóstico.

## Capabilities

### New Capabilities
- `shared-select-interaction`: interacción accesible y estable del selector compartido.

### Modified Capabilities
Ninguna. API del componente y contratos IPC/datos conservados.

## Impact

Control UI, módulo pequeño de navegación, suite existente y smoke local aislado. Documentación de accesibilidad, pruebas y seguimiento IRIS. Sin dependencias, canales, secretos ni escrituras remotas. No se declara certificación ni resolución de RLS/borrado IRIS.
