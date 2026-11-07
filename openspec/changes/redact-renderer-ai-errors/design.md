## Context

Los errores de SDK pueden incluir solicitudes y detalles de transporte. La UI y
la consola necesitan un diagnóstico útil sin publicar esos detalles.

## Decisions

Se utiliza la clasificación pública existente cuando se requiere categoría y
mensajes fijos cuando basta identificar la operación. Los reintentos, el error
lanzado al consumidor y los resultados de fallback se conservan; el dictado
convierte el error de proveedor en un mensaje público antes de mostrarlo.

## Risks

Esta protección cubre las rutas modificadas; los demás logs y la custodia de
claves Gemini siguen pendientes. La revisión independiente continúa pendiente.

La fase de acciones tras investigar también registra mensajes públicos y conserva
el resultado previo si falla el modelo o se cancela la operación.
