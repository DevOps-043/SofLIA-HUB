## Context

Un error de `get_api_key` no demuestra ausencia; autorizar fallback en ese caso
puede seleccionar una credencial distinta. Las respuestas de error pueden incluir
valores sensibles y la duplicación permite evitar invalidaciones de sesión.

## Decisions

Rechazar fallas y tipos inesperados con mensaje fijo. Sólo null indica ausencia.
Errores de mutación conservan `success: false` con texto público. El módulo
histórico reexporta las funciones canónicas. Validación usa cabecera oficial
`x-goog-api-key`. No se cambian permisos o proveedor. Las solicitudes enviadas
no son reversibles y Gemini permanece en renderer; revisión independiente pendiente.
