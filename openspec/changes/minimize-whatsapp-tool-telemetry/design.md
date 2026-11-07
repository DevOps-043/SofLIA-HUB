## Context

Ver propuesta. El resumen actual sirve a la vez al historial y al loop guard. Las firmas son JSON, no hashes, aunque el comentario las describe como hashes. El store serializa metadata arbitraria y el productor persiste la firma de argumentos.

## Goals / Non-Goals

**Goals:** telemetría útil sin payload, comparación privada durante el turno, resultados originales intactos y errores inesperados correlacionables.

**Non-Goals:** cifrado/retención global del historial, borrar legado, cambiar conversación ni prometer redacción de toda respuesta normal de dominio.

## Decisions

- Un módulo de observación con campos cerrados: nombre identificador acotado, booleanos de resultado/parcialidad y contadores enteros no negativos. Estados sólo de vocabulario cerrado; sin message/error/session_id ni argumentos. Permitir duración y UUID de correlación en metadata. El productor y el store usan la misma proyección para no divergir.
- Para kind:tool el store omite text/media/metadata arbitraria y proyecta también registros heredados antes de filtros/búsqueda/salida. No reescribe ni elimina el archivo anterior. Los eventos no-tool mantienen su contrato y política; los contactos siguen siendo necesarios para el historial.
- Resumen tipado seguro para loop guard; hasError representa error presente, sin texto. Conservar progreso y flags evita clasificar avances como polling sin cambio. La comparación de respuesta incluye, mediante huella privada, campos legacy relevantes (errores/mensajes/estado/session_id/pid) sin copiarlos al resumen.
- Huellas HMAC-SHA256 con clave aleatoria por objeto de turno guardada en WeakMap, nunca persistida. Comparan llamadas/resultados en memoria y reemplazan JSON crudo en trace; al historial sólo va UUID/duración, no firma ni clave. No usar hashes públicos persistentes de argumentos susceptibles de diccionario.
- El UUID de correlación de cada excepción se conserva en diagnóstico pero se excluye de la firma de respuesta: una referencia nueva del mismo error no debe simular avance. Un fallo inesperado de ejecución marca uncertain/recoveryRequired porque su efecto puede ser desconocido; el fallo de guarda indica que no se ejecutó.
- Dispatcher y fallback convierten excepciones inesperadas a mensaje fijo con errorCode/correlationId; logger estructurado sin err, toolArgs ni nombres inválidos. Guardas que lanzan se consideran fallo de autorización y no ejecutan el tool. Respuestas normales de cada dominio siguen intactas.
- Registrar trace antes de intentar history. Capturar fallo síncrono o Promise rechazada de recordHistory sin cambiar el resultado ni repetir efectos; reportar fallo saneado por correlación. El store también sanea errores de archivo.

## Risks / Trade-offs

- Menos detalle en telemetría → estados/conteos/duración/correlación mantienen diagnóstico; contenido sólo en resultados funcionales del turno.
- Contenido heredado físico → proyección al leer y preservación de bytes; retirada/cifrado requiere trabajo explícito aparte.
- Guardas de repetición → pruebas de igualdad y cambios relevantes, avance de lotes y regresiones del loop. Las huellas no son idempotency keys ni historial durable.
- Roles/permiso/PII de eventos no-tool → se mantienen sin afirmar una solución global. No se añaden flags o permisos runtime.

## Migration Plan

Sin SQL/dependencias/canales. Probar reproducción de filtrado, archivos temporales reales, normalización idempotente y lectura legacy, productor/trace, errores de guard/fallback y regresiones de tool-loop. Ejecutar tipos/lint/build/verify:pr. Revertir esta unidad conserva las ocho previas pero puede reintroducir escritura privada; preferir conservar el filtro de store. Revisión independiente pendiente antes de archivar.
