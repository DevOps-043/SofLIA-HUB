# Verificación del lote 41

Fecha: 2026-10-26. Implementación integrada y verificada localmente;
revisión independiente pendiente.

## Cambio y evidencia dirigida

Servicio/handler/preload/wrapper tipados para generación con fuentes. Fuente,
sesión y revisión nativas se comprueban antes/después de esperas; Stop y plazo
cancelan HTTP. Un canal de cancelación propio valida trabajo/emisor. Endpoint
fijo, clave en header, cuota UTF-8, respuesta incremental acotada y plazas
retenidas hasta terminar transporte y cierre del stream, sin cola.

Electron no hace fallback HTTP tras puente ausente/denegado; la ruta web
independiente conserva transporte explícito con límites. Se mantienen búsqueda,
URL y code_execution bajo la política local que ya utilizaba el renderer.
Errores nativos y de proveedor son fijos. Fuentes/partes se estrechan desde
unknown, sin any público nuevo. No se añaden dependencias ni herramientas locales.

Antes de cambiar producto, seis pruebas causales fallaban: ausencia de sesión,
ventana ajena/subframe, navegación durante fetch, code_execution rechazado y
error del proveedor reflejado. Suite dirigida final: 120 aprobadas, cero fallos
en siete archivos; 49 casos nuevos. Comprueba cuatro capas, cuotas, plazo,
A/B/A/destrucción, cancelación ajena, busy y consumidor completo sin bypass.

Los tests existentes de navegador se actualizaron para comprobar la clave en
header y su ausencia de URL; su fallback de clave de proveedor se conserva.
Sin modelos, red/cuentas, claves reales o GUI. Los servicios/transporte son
reales con fetch y puertos Electron sustituidos.

## Verificación global final

La [compuerta de PR](gate-summary.json) terminó con código 0: 14 etapas,
6328 pruebas aprobadas y cinco omitidas, 62 pruebas de tooling y 33 de Python.
Incluye typecheck, lint de 531 archivos y comprobación de 827 documentos Markdown.
Los cinco casos omitidos se conservan; no se presentan como aprobados.

El [análisis completo de lint](lint-evidence.json) conserva deuda histórica
(código 1): 1876 → 1838 errores totales y 1456 → 1418 en producción; any
explícitos en producción 1283 → 1245. Se eliminaron 38 errores, con 31 avisos
sin cambios, cero fatales y ningún aumento por archivo/regla/severidad.
No se relajaron reglas ni exclusiones.

La [cobertura](coverage-evidence.json) incluye los 2579 archivos de producción:

| Métrica | Unidad 40 | Unidad 41 |
| --- | ---: | ---: |
| Líneas | 57.61% | 57.77% |
| Sentencias | 56.28% | 56.43% |
| Funciones | 52.51% | 52.59% |
| Ramas | 50.19% | 50.41% |

Los umbrales permanecen en 56/55/51/49, respectivamente. Persisten 1001 archivos
sin cobertura de sentencias; superar la compuerta no cierra toda esa deuda.

El [build aislado](build-summary.json) terminó con código 0, 3548 fuentes
copiadas y verificadas y seis salidas; no empaquetó ni inició la aplicación.
El [inventario de fuentes](source-evidence.json) confirma 3568 archivos sin
cambios durante la compuerta: SHA-256
`3feb0b6abe9a44b097fcc3db5f12d2001b166ac280786e7ea5ece4aa3f0aec18`.
Delta de producto/pruebas respecto de unidad 40: siete archivos existentes y
ocho nuevos. Dependencias, reglas, cobertura y política de modelos conservadas.

[Regresiones dirigidas](regression-summary.json) y [hashes de logs](log-evidence.json)
permiten contrastar las cifras. Estos avances no equivalen a una reevaluación
del índice global: el último publicado, tras unidad 37, es 40.88%.

## Revisión propia

Se intentó refutar la autoridad en origen y tras esperas, cancelación de otra
ventana/revisión, liberación prematura de plaza, texto no JSON y respuestas no
objeto, cuotas por bytes reales y cabecera falsa, errores que filtran secretos,
MIME ejecutable y fuentes con URL fallida o protocolo inválido.

La revisión corrigió dos detalles: preservar índices de chunks inválidos para
no atribuir snippets a otra fuente, y retener la promesa original de cierre del
reader cuando cancelar tarda (una segunda llamada a cancel no prueba ese cierre).
También exige puente moderno completo para generar/cancelar. Sin supresiones,
relajación de reglas o eliminación de funcionalidades para pasar pruebas.

Revisión independiente pendiente; la propia no la sustituye. No archivar.

## Límites y reversión

Claves de usuario/entorno siguen resolviéndose en renderer; no se acredita
custodia general de claves ni se retiran todos los SDK/VITE del producto.
Compatibilidad del proveedor se rige por política existente, sin consulta real
del modelo. El proveedor valida semántica de partes/configuración REST. Formato
de fuentes no demuestra verdad de cada afirmación ni protege de todo contenido.

Plazo 150 s por intento; fallback tras error de proveedor puede reenviar contexto
y prolongar turno. Rechazo de autoridad/busy/cancelación no se reintenta ni
cambia transporte. Cancelar no retira datos/costos ya aceptados por terceros.
Navegador independiente tiene cuota por proceso, no global entre pestañas.

Respaldos relativos y logs en TEMP/soflia-grounded-generation-2026-10-26. Revertir
sólo delta contra unidad 40, preservando índice ajeno. Sin secretos/.env, SQL,
stage/commit/push, cambios de dependencias o despliegue.
