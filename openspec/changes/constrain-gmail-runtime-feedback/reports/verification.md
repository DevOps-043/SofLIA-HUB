# Verificación de alcance del feedback Gmail runtime

Estado: implementada y verificada localmente; revisión independiente pendiente.
Fecha: 2026-10-22. Rama: codex/reduce-technical-debt.
Base: e166d250629e503cf12f69449fb6d66e569134c8. Sin commit/push ni llamadas reales.

## Resultado

Se retiró el verificador que consultaba toda una etiqueta tras modificar un
mensaje y ordenaba continuar hasta vaciarla. También se retiró su estado
bulkLabelsToVerify de ejecutores Google, dispatch, loop y fixtures; Calendar,
Drive y Chat dejan de transportar estado de Gmail que no utilizaban. Se
conservan los módulos, contenedores response/responses, permisos, catálogo,
controles de grupo, confirmación e intención existentes.

El loop entrega únicamente los resultados originales de las llamadas ejecutadas.
Los resultados parciales, cancelados e inciertos conservan sus conteos/flags.
La paginación Gmail mantiene token/indicador de más resultados como datos y
retira la instrucción de continuar leyendo. Los tres ejecutores Gmail sanean
excepciones inesperadas; el flag delete_label llega al schema sin coerción.

El adaptador Responses deja de convertir resultados extra en mensajes user.
Los rechaza antes de modificar historial/pending; la entrega puede corregirse
sin duplicar outputs. Valida catálogo, argumentos objeto y call_id no vacío/único
en todo el lote del proveedor antes de publicar llamadas. Se mantiene el error
local que cierra una llamada bloqueada por una guarda sin ejecutarla.

El uso de function_call_output ligado al call_id se contrastó con los tipos del
SDK instalado y la [documentación oficial de function calling](https://developers.openai.com/api/docs/guides/function-calling),
consultada el 22 de octubre. El rechazo local de extras es una política del Hub;
no se presenta como garantía del proveedor ni como ejecución remota probada.

## Evidencia

| Verificación | Resultado |
|---|---|
| Baseline agente/ejecutor/buzón/IPC | 4 archivos, 154 pruebas aprobadas |
| Reproducción antes del arreglo | Dos casos fallidos: lectura global tras modificación y tras cambio de cuenta; tres controles aprobados |
| Suite dirigida final | 8 archivos, 194 pruebas aprobadas |
| Typecheck renderer/main | Aprobado |
| Lint incremental | 125 archivos sin deuda nueva |
| Inventario derivado | 625 archivos de prueba, 494 canales; dos suites nuevas y ninguna dependencia/canal nuevo |
| Build aislado | Aprobado: 3299 fuentes y seis artefactos, sin .env, empaquetado ni arranque |
| verify:pr | Aprobado: 4806 pruebas, 5 omitidas; 455 archivos aprobados y 2 omitidos; suite de 217,41 segundos |

La unidad añade 32 casos: seis de integración de feedback, 19 de ejecutores y
siete del adaptador. La compuerta también aprueba tipos, 125 archivos de lint sin
deuda nueva, 78 elementos OpenSpec, cuatro pruebas de tooling, adaptadores,
arnés, política de dependencias, documentación/enlaces y semilla de skills.
El [resumen estructurado](verification.json) registra esas cifras. Se conservan
advertencias preexistentes de Vite/Node; no se silencian para obtener el resultado.

La suite dirigida integra servicio Gmail y disco temporal reales con ejecutor
Google, loop y adaptador Responses. Aísla transporte, registro de historial y
ejecución de guardas con dobles; la guarda de intención sí se ejecuta. Las
guardas de grupo/confirmación conservan la suite de executor existente. No hay
correo, proveedor IA, WhatsApp, datos ni credenciales reales.

Logs temporales en `%TEMP%/soflia-gmail-runtime-2026-10-22/`: baseline.log,
reproduction-red.log, directed-final.log, typecheck-final.log, lint-first.log,
build-final.log y verify-pr-final.log. Los informes versionados conservan las
cifras finales aunque caduquen estos temporales. [Resumen de build](build-summary.json)
y [hashes de artefactos](build-artifacts.json). Persisten advertencias de tamaño
de chunks/importaciones dinámicas; no se silenciaron ni se atribuye una mejora
de rendimiento a esta compilación.

## Autorrevisión adversarial

| Hipótesis | Comprobación |
|---|---|
| Modificar uno ordena vaciar otros o consulta la cuenta nueva | Reproducción roja antes del arreglo; servicio/ejecutor/loop/adaptador prueban ausencia de lectura extra y los otros mensajes intactos |
| El resultado parcial/cancelado se convierte en éxito u orden nueva | Mismo resultado preservado hasta el output correspondiente, sin verificación posterior |
| Dos llamadas del mismo nombre reciben resultados cruzados o extra | Orden y call_id de dos modificaciones con distinto avance; exactamente dos outputs |
| Los extras se elevan a mensaje user | Extras de nombre igual/ajeno rechazados; ningún request adicional ni estado parcial; entrega corregida sólo una vez |
| Un prefijo válido de lote inválido queda pendiente | Herramienta fuera de catálogo, argumentos array o call_id duplicado rechazan todo el lote antes de publicar pending/historial |
| Flag inválido se convierte en false y permite un efecto distinto | Cero, vacío, null y string false llegan al schema, se rechazan y no adquieren cliente |
| Retirar estado rompe Calendar/Drive/Chat o sus guardas | Resultados de servicios hermanos y regresiones de dispatcher/grupo/HITL aprobados |
| Se filtra un error del ejecutor Gmail | Excepciones ficticias privadas sustituidas por mensajes genéricos en etiquetas, mensajes y planes |

Autorrevisión, no revisión independiente. El archivo retirado no deja imports
ni referencias activas del sidechannel. El historial general del dispatcher
todavía puede contener argumentos/respuestas privadas fuera del alcance de
este arreglo; se registra como siguiente área, sin afirmar redacción integral.

## Límites y reversión

- El modelo puede proponer nuevas llamadas; permisos/HITL siguen siendo la
  frontera. No hay firewall semántico ni prueba con proveedor real.
- Los contratos main/preload/renderer y los diarios de planes no cambian. No
  se garantiza recuperación transaccional ante fallo de red del adaptador.
- Sin nuevas migraciones, permisos o persistencia. Eliminar código reduce
  estado y consultas implícitas; no recalcula el porcentaje global de deuda.
- Revisión independiente pendiente antes de archivar. No se ejecuta release,
  instalador ni Hub con cuentas reales.

Revertir únicamente esta unidad conserva las siete anteriores. Reintroducir el
verificador restituye el riesgo de ampliación de alcance; preferir mantener su
ausencia y corregir una regresión localizada. Revertir código no revierte
acciones ya aceptadas por Gmail ni mensajes ya enviados al proveedor.
