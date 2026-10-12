## Context

La captura del usuario confirma finalización en dos pasos sin resultado visible. El motor devuelve completada al recibir texto, incluso tras una excepción del ejecutor. El fallback no hace fallar errores no terminantes de PowerShell y nut.js usa require sin cargarlo explícitamente en ESM.

## Decisions

- Error pendiente impide completar hasta ejecutar una acción de recuperación; una llamada desconocida nunca es éxito.
- Las llamadas de una respuesta se conservan y ejecutan en orden. Un fallo cancela las pendientes del lote y comunica explícitamente cada omisión antes de pedir otra decisión al proveedor.
- Preservar el punto de una escritura dirigida y enfocar antes de escribir.
- PowerShell recibe scripts completos codificados y convierte errores en rechazo; Win/Super se sintetiza realmente en el fallback.
- Usar createRequire para el backend nativo y rechazar teclas desconocidas.
- El escritorio verifica cambios de pantalla y pide corroborar la meta con la captura más reciente antes de aceptar texto terminal; no repetir acciones por el mero hecho de verificar.
- Prueba nativa en ventana propia, con clic y texto comprobados desde su DOM. No usar otras aplicaciones ni datos reales para QA.

## Limits

La visión de IA sigue siendo imperfecta. Ninguna prueba local de entrada acredita que una llamada real al proveedor complete todas las aplicaciones. El resultado de QA debe distinguir entrada física de inferencia del modelo.
