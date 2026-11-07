## Context

El modelo, prompts y operaciones Flow están fijados por el producto. La ruta
nativa conserva esos contratos y resuelve la credencial con sesión vinculada.

## Decisions

Tres operaciones cerradas, sin modelo, clave, URL o instrucciones arbitrarias.
Main construye prompts, limita texto y medios, valida MIME/base64, salida,
cuatro trabajos físicos y plazo; una plaza se conserva hasta terminar I/O.
El renderer conserva sus guardas de sesión y la ruta web autónoma. No se reintenta
una operación revocada y no se afirma cancelar un trabajo remoto ya enviado.

## Risks

La clave sigue accesible en otros flujos Gemini. Los límites pueden rechazar
medios grandes; falta comprobar cuenta real y revisión independiente.

El dictado rechaza audio mayor de 12 MiB antes de leerlo; el límite de 16 MiB
base64 en main comparte la misma fuente de constantes.
