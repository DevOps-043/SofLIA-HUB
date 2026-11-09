## Context

La investigación tiene validación JSON, cuota, plazo y cancelación física en main.
La autoridad Gemini ya vincula el documento Hub/Orbe y la sesión Lia.

## Decisions

El DTO IPC sólo transporta modelo, contexto e identificador. El servicio adquiere
la plaza antes de resolver la credencial y revalida antes del HTTP. Un cambio de
sesión cancela y conserva la plaza hasta que termine la llamada física.

Electron selecciona la credencial según la política nativa existente. Usa la
configuración de main cuando falta una credencial personal. Un rechazo de consulta
no habilita otro intento. El navegador independiente conserva selección web.
El renderer comprueba vigencia del turno antes de publicar o reintentar.

## Risks / Trade-offs

La configuración compartida de main puede sustituir una clave ausente. Si el
proveedor rechaza una clave personal, Electron conserva esa identidad en los
intentos con otros modelos. El navegador independiente mantiene su política.

## Migration Plan

Actualizar main y preload/renderer en el mismo build. Revertir juntos los cambios
al contrato desde el respaldo del lote. Se conservan los canales existentes.
