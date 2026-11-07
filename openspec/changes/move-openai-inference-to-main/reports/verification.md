# Verificación del lote 47

Fecha: 2026-10-30. Implementado y verificado localmente; revisión independiente pendiente.

## Alcance

Responses normal/streaming vive en main con SDK instalado. Cuatro capas con
open/start/pull/cancel, credencial derivada por sujeto/proveedor, scope revocable
y cuotas físicas. Renderer conserva pipeline de modelos/herramientas/citas/uso,
sin construir SDK HTTP ni consultar la clave OpenAI. Un caso causal falló antes
del cambio porque el cliente consultaba la clave y construía el SDK en renderer.
Vite publica entorno explícito con flags DEV/PROD/MODE y excluye OpenAI de
renderer/preload, manteniendo fallback main. No se tocaron .env o secretos reales.

Se reutiliza el snapshot JSON acotado en grounding y OpenAI mediante módulo
compartido; el consumidor grounding conserva límites y exportaciones anteriores.

## Verificación y revisión propia

Pruebas: fuente ajena/subframe/documento, A/B/A, navegación, credencial OpenAI
correcta sin confundir SOFIA/Lia, RPC fallido sin fallback, lectura/replay y
concurrencia. SDK real con fetch ficticio para Responses normal/SSE; los dos
consumidores reales conservan datos y el chat reinyecta herramientas al dispatcher.

Se intentó cancelar durante admisión/proveedor/next/return, abandonar antes del
primer next, desbordar evento/resultados y vencer plazos con I/O que ignora señal.
La revisión corrigió cierre antes de consumir y cancelación duplicada del wrapper,
propagación de categorías sin mensajes privados, y conservación de retry-after.
TypeScript inicial señaló puente opcional dentro de una clausura; se fijó una
referencia estrechada, sin any o relajación del compilador.

La revisión de la transición Auth encontró que main publica su nueva identidad
antes de esperar applyHubSession. Se añadió un recibo de Lia sólo tras aplicación
aceptada y revalidación, sin igualar sujetos SOFIA/Lia. La sesión Lia previa no
autoriza OpenAI durante esa transición; se prueba en el handler Auth real y en
el módulo del recibo, incluidas A/B/A y ausencia/cambio de sujeto. La primera
compuerta/build se interrumpieron para este arreglo; logs bajo attempt-first y
motivo/procesos propios en interrupted-first.json. No cuentan como verificación final.
Una segunda pasada cotejó el selector y detectó esfuerzo max admitido por el
producto: se conservó en el parser y en prueba del consumidor real. Esa corrida
se interrumpió antes de aceptar evidencia; attempt-second/interrupted-second.json
conservan su motivo. Los dos intentos anteriores no acreditan el estado final.
La revisión de fallos estructurados añadió dos casos rojos causales (respuesta
normal y evento terminal SSE con error de clave ficticio): ambos filtraban el
objeto del proveedor antes del ajuste y ahora devuelven sólo categoría
finita invalid_key. provider-error-red.json/log conservan 2 rojos/13 verdes;
el tercer intento se interrumpió y queda en attempt-third/interrupted-third.json.

Revisión independiente pendiente; la revisión propia no la sustituye. No archivar.

## Resultado final

Compuerta verify:pr aprobada en 578.20 segundos: 14 etapas, 6746 pruebas
aprobadas y cinco omitidas (560 archivos aprobados, dos omitidos), 62 pruebas
de tooling y 33 Python. Typecheck, arnés, integridad CI, runtime estable,
documentación y lint incremental de 637 archivos terminaron con código cero.
La suite dirigida final aprobó 194 casos en 14 archivos; 74 son nuevos frente
al lote 46. El esfuerzo max pasa tanto parser como consumidor real.

| Métrica | Lote 46 | Lote 47 |
| --- | ---: | ---: |
| Errores ESLint globales | 1760 | 1759 |
| Errores en TS productivo | 1350 | 1349 |
| Mensajes any en TS productivo | 1177 | 1176 |
| Cobertura de líneas | 58.93% | 59.14% |
| Cobertura de sentencias | 57.50% | 57.72% |
| Cobertura de funciones | 53.74% | 53.93% |
| Cobertura de ramas | 51.18% | 51.47% |

ESLint completo conserva salida 1 por deuda histórica: 31 avisos, cero fatales
y ningún incremento por archivo/regla/severidad. No se alteraron dependencias,
políticas, pisos de cobertura, exclusiones ni selección de modelos. V8 incluye
2607 fuentes productivas, incluidas las no importadas.

Build aislado aprobado en 194.42 segundos, sandbox pulse-app-build-4lmhJn:
3602 archivos copiados coinciden por SHA con las fuentes; seis salidas no vacías.
El centinela ficticio OpenAI está ausente de los 40 artefactos renderer y del
preload producido; está presente en main como control positivo del fallback.
No se copiaron .env ni se arrancó/empaquetó la aplicación. Persisten avisos
históricos de chunks grandes, sin elevar sus límites para ocultarlos.

3622 fuentes verificadas antes/después de la compuerta sin cambios, SHA-256 del inventario
c91627a732feaded3562a2b89d0a57deb4e50768887662d396a2dec4303bd78d.
El delta frente al lote 46 contiene 31 fuentes (20 nuevas y 11 existentes), con
respaldos de cada existente verificados contra su hash anterior. Se preservó
la eliminación ajena staged de bulk-label-verification.ts. Los tres intentos
interrumpidos quedan separados de esta compuerta y build finales aprobados.

El chequeo final de whitespace señaló una línea vacía sobrante al final de
src/config.ts. Se quitó después de la compuerta: sólo cambia whitespace terminal
y el JavaScript transpilado antes/después es idéntico. La prueba proporcional
de formato sustituye repetir pruebas funcionales por ese ajuste; los hashes
probados y el inventario final se distinguen en la evidencia de fuentes.

Recibos: [compuerta](gate-summary.json), [regresiones](regression-summary.json),
[lint](lint-evidence.json), [cobertura](coverage-evidence.json),
[build y centinela](build-summary.json), [fuentes](source-evidence.json) y
[logs](log-evidence.json).

## Límites y reversión

Gemini/medios/OAuth y otros RPC/accesos a credenciales no se declaran migrados.
Una clave incluida en main sigue extraíble del instalador: falta broker servidor
con autorización/cuotas para retirar credenciales compartidas del cliente completo.
No se ejecutó SQL remoto ni se acreditó política RLS o proveedor real.

Cancelación evita publicaciones/pasos siguientes pero no revierte I/O enviado.
Una dependencia que nunca termina puede retener plaza; no se fabrica progreso
físico por timeout. Payloads del modelo siguen siendo datos no confiables.

Respaldos/logs en TEMP/soflia-native-openai-2026-10-27 frente al lote 46. Reversión
sólo del delta; índice/trabajo ajenos preservados. Sin stage/commit/push,
despliegue, proveedor/cuentas/GUI reales o secretos. El último porcentaje global
publicado tras lote 37 sigue histórico (40.88%); estos contadores no lo recalculan.
