# Diseño

El proveedor del panel filtra actividades `kind: computer` sin artefactos, tanto
al decidir apertura automática como al construir los elementos visibles. El
monitor runtime conserva los eventos originales.

El verificador CU devuelve `canContinue` junto con `confirmed` y `reason`.
Solo una transición pendiente observable y segura permite `canContinue: true`.
El loop añade la captura y el motivo a la conversación existente, conserva driver,
señal y guardas y consume presupuesto por cada recuperación. Hay como máximo dos
recuperaciones por loop. No se relanza la aplicación ni se crea otro equipo.

Los prompts distinguen esperar y continuar una tarea autorizada de pedir datos,
acceso o aprobación HITL. Los estados de fallo, cancelación y presupuesto agotado
se reportan con honestidad; no habilitan reintentos ilimitados desde el chat.
