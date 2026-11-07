## Context

Ver propuesta. Preview/apply/undo no tienen pruebas propias, usan archivos globales y adquieren clientes nuevos mediante callbacks del servicio. Gmail y el disco no comparten transacción. Calendario ya dispone de cifrado asíncrono del SO y escritura privada; se compartirán esas primitivas, conservando sus wrappers y pruebas.

## Goals / Non-Goals

**Goals:** owner usuario/cuenta, flujo completo de planes con guardas, checkpoints, errores seguros y semántica comprobable de repetición/reversión.

**Non-Goals:** todos los demás canales Gmail, migrar planes de dueño desconocido, recuperación remota automática o SQL.

## Decisions

- Nuevo directorio gmail-private-plans/<hash de usuario/cuenta>/<ID UUID>.bin. Dentro del cifrado se comprueban versión, owner e ID; no se importan JSON globales sin dueño. Guardar sólo IDs/etiquetas/grupos necesarios para undo; sin cuerpos ni remitentes/asuntos de cada mensaje. Máximo 2 MiB de JSON y 100 planes por cuenta; no borrar automáticamente para liberar cuota.
- Separar store, schema, contexto de ejecución y apply/undo. Un contexto fija owner/revisión/conexión y cachea un cliente para toda la operación. Cada espera revalida antes del siguiente efecto; el cierre contable se escribe exclusivamente al owner/ruta capturados, incluso si la sesión vence.
- Checkpoint previo por creación de etiqueta, lote de hasta 100 mensajes, inversión de mensaje y borrado de etiqueta vacía. Si queda pending no se ejecuta automáticamente otra vez: se requiere revisión manual. Esto conserva intención ante crash sin inventar exactamente-una-vez.
- Estados preview/applying/applied/undoing/undone/partial. Repetir applied/undone devuelve resultado guardado; partial o estado en curso con pending bloquea replay. Una reversión interrumpida sin pending puede continuar con nueva aprobación y omite IDs ya confirmados.
- Antes de aplicar un lote leer sus etiquetas actuales y guardar el delta real, no usar un snapshot antiguo. Antes de undo comparar con el resultado esperado del plan; una diferencia se informa como conflicto. Etiquetas creadas con mensajes nuevos se conservan.
- Una exclusión por owner en el proceso evita carreras entre instancias; no promete bloqueo entre procesos ni CAS remoto. Guardar antes de tocar Gmail y registrar conteos después. Errores/logs no contienen payload, títulos, rutas ni errores crudos.
- Main usa la guarda/confirmación IPC ya compartida. Preload y renderer comparten opciones/resultados tipados sin canales nuevos. Runtime conserva su HITL previo y recibe las mismas guardas del servicio.
- El caller expone AbortSignal para navegación/cierre/cambio de sesión; el diálogo nativo y las solicitudes SDK lo reciben. La aprobación conserva 120 segundos; la ejecución dispone de 90 segundos desde la primera llamada, solicitudes de hasta 15 segundos sin retry y ocho lecturas de estado previo paralelas. Se propaga también la señal al envío Gmail (15 segundos, sin retry) y al diálogo del calendario, porque comparten la misma autorización. El transporte de calendario conserva sus guardas de sesión previas.

## Risks / Trade-offs

- Falta atomicidad remota/disco → intención previa, bloqueo de replay incierto y revisión manual; sin falso rollback.
- Cambios concurrentes externos → precondiciones de etiquetas; la ventana entre comprobar y mutar no puede cerrarse sin CAS del proveedor.
- Planes heredados dejan de ejecutarse → conservar archivos intactos y exigir un preview nuevo; no atribuir propiedad por sesión activa.
- Cifrado/FS compartidos → pruebas existentes de calendario y smoke DPAPI real tras extracción. Sin fallback plano ni lectura de perfiles reales.
- Cuota alcanzada → error visible, sin eliminación automática de evidencia; limpieza manual autorizada aparte.

## Migration Plan

Sin SQL ni nuevas dependencias. Leer sólo directorio nuevo privado; no modificar el legado. Probar archivos reales/cifrado inyectado, fases de fallo/guardas/repetición, tres canales y wrappers, smoke DPAPI del store compartido, build aislado y verify:pr. Revertir la unidad conserva archivos cifrados y bloques anteriores; no reactivar automáticamente planes legacy. Revisión independiente pendiente antes de archivar.
