# Verificación del lote 43

Fecha: 2026-10-26. Implementado y verificado localmente;
revisión independiente pendiente.

## Alcance y evidencia dirigida

El adaptador GUI heredado deja de construir shell con texto del usuario:
programas fijos y datos en stdin/argv por plataforma. Conserva funciones,
tipa/valida acciones y teclas, acota procesos y retiene trabajo hasta close.
La lease main se propaga por dispatcher y captura identidad también en runtime.
No se abre computer:use-computer en preload: se prueba su rechazo existente.
Las otras APIs/controles de Desktop Agent conservan sus contratos propios.

Antes de modificar producto fallaron cinco regresiones causales: shell ante
texto hostil, key malformada, NaN, estructura Tesseract 7 y worker sin finally.
Suite dirigida final: 283 aprobadas, cero fallos en once archivos; 69 casos nuevos
respecto de unidad 42 (68 en cuatro archivos nuevos y uno en IPC existente).

Procesos, capturas, OCR y demás servicios no GUI son puertos sustituidos. Un
thread Node inocuo real comprueba exit físico frente a terminate público temprano;
no ejecuta Tesseract ni modelos. PowerShell se analiza con AST nativo y Python
con ast.parse, sin ejecutar programas. No se usa GUI/preview, shell de
automatización, permisos nativos ni cuentas reales.

## Verificación global final

La [compuerta de PR](gate-summary.json) terminó con código 0 en sus 14 etapas:
6474 pruebas aprobadas, cinco omitidas, 62 pruebas de tooling y 33 de Python.
Incluye typecheck, lint incremental de 557 archivos y 841 documentos Markdown.
Los cinco casos omitidos no se presentan como aprobados.

El [lint completo](lint-evidence.json) conserva deuda histórica (código 1):
1827 → 1823 errores totales y 1407 → 1403 en producción; any explícitos
1234 → 1230. Cuatro errores eliminados, 31 avisos conservados, cero fatales y
ningún aumento por archivo/regla/severidad. Sin reglas o exclusiones relajadas.

La [cobertura](coverage-evidence.json) comprende 2590 fuentes productivas:

| Métrica | Unidad 42 | Unidad 43 |
| --- | ---: | ---: |
| Líneas | 57.90% | 58.11% |
| Sentencias | 56.55% | 56.77% |
| Funciones | 52.89% | 53.03% |
| Ramas | 50.48% | 50.70% |

Los pisos siguen en 56/55/51/49. Persisten 1000 archivos sin cobertura de
sentencias; la mejora de este lote no cierra toda la deuda de pruebas.

[Build aislado](build-summary.json) correcto, con 3566 fuentes copiadas y
verificadas y seis salidas. No empaquetó ni inició aplicación. El
[inventario](source-evidence.json) confirma 3586 fuentes sin cambios durante
las comprobaciones: SHA-256
`681195072b53a28b3a8598ef92b1c56cded9ffd275211dbdbff50eb92cbd3ad4`.
Delta frente a unidad 42: seis archivos existentes y doce nuevos; respaldos de
los seis contrastados con los hashes anteriores.

[Regresiones](regression-summary.json), [sintaxis](script-syntax.json),
[logs](log-evidence.json) y [comprobaciones finales](final-checks.json) conservan
los recibos. El primer gate/build se [interrumpió](verification-rerun.json) para
ajustar el contexto System Events de los modificadores AppleScript; se repitieron
pruebas dirigidas, compuerta, build y lint sobre el inventario final. Sólo esos
resultados finales acreditan esta entrega. No se acredita compilación AppleScript
nativa ni GUI real.

No se infiere un porcentaje global desde estas métricas. El último índice
publicado, tras unidad 37, sigue siendo 40.88%; no es una reevaluación del lote 43.

## Revisión adversarial propia

Hipótesis: texto hostil convertido en programa/flags; SendKeys especiales;
texto largo que excede línea de comando Windows; coordenadas no finitas;
teclas inválidas, plataforma/Wayland/headless no disponibles; salida conjunta
excesiva; cierre lógico confundido con físico; A/B/A/fuente revocados durante
captura/OCR/proceso; capturas de error posteriores y excepciones privadas.

Se corrigieron además: middle_click Windows sin evento, drag que era click,
aliases de teclas por plataforma, palabras/lines ausentes en Tesseract 7 y
terminate que no espera el thread subyacente. Se limita texto/nodos OCR y se
rechazan múltiples objetivos distintos; screenshot fallida no refleja excepción.
Progresos requieren lease. El lint dirigido queda sin errores/avisos, sin
supresiones nuevas o relajación de reglas.

Revisión independiente pendiente; no sustituida por la propia. No archivar.

## Límites y reversión

No acredita entrada física, permisos, sintaxis AppleScript ejecutada o backends
nativos reales en los tres SO. No sustituye Desktop Agent ni coordina sus drivers
con otros procesos. Cerrar un hijo no revierte eventos, ni garantiza soltar un
botón si el SO interrumpe el finally. Un hijo que no cierra conserva exclusión.

OCR conserva adquisición/fallback de modelos del proveedor, sin garantía offline.
El worker retornado se termina y se espera su thread nativo reconocido; un fallo
interno de creación que no devuelve worker sigue dependiendo del proveedor y no
acredita limpieza de ese recurso. El plazo revoca autoridad, sin prometer que
termine creación/cierre del proveedor exactamente a los 60 s. No se reintenta un
efecto incierto. Errores main siguen la respuesta fija de unidad 42.

Respaldos relativos/logs en TEMP/soflia-gui-backends-2026-10-26. Reversión sólo
del delta frente a unidad 42, preservando índice y trabajo ajenos. Sin cambios
de dependencias, secretos/.env, stage/commit/push, SQL o despliegue.
