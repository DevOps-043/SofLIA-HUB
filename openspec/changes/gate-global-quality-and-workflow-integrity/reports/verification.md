# Cobertura global e integridad de workflows

Estado: implementación local, compuerta completa con cobertura y build aprobados. Revisión independiente pendiente, sin archivar. No acredita despliegue.

## Resultado y alcance

Se reemplaza test por test:coverage en el gate, manteniendo una sola ejecución
de Vitest y todos los controles anteriores. V8 mide toda producción TS/TSX
src/electron, incluidos archivos sin importar. El verificador compara las
fuentes del reporte con Git y rechaza omisiones, archivos ajenos, métricas
imposibles, totales incoherentes, ausencia de reporte y cobertura bajo pisos.

La política CI recorre workflows y actions compuestas locales, incluso fuera
de .github/actions. Se fijaron las 18 referencias mutables existentes; CI y
release conservan summary/LCOV siete días, sin permisos nuevos. La política
rechaza tags/ramas, SHA incompleto, expresiones, Docker sin digest, YAML
inválido, rutas escapadas y enlaces. No ejecuta Actions remotas.

## Baseline medido

Una suite V8 completa antes de cambios de producto aprobó 6053 casos, cinco
omitidos, en 262.61 s. Los hashes de las 3528 fuentes coincidían con el cierre
de la unidad 36. El remapeo añadió tres mocks de test/mocks/electron fuera del
include; se detectaron mediante inventario y se computó el baseline productivo
excluyendo únicamente esos fixtures, no fuentes de producción. Se integró
excludeAfterRemap con test/** para que el reporte final tenga alcance correcto.

| Métrica | Cobertura productiva inicial | Piso versionado |
|---|---:|---:|
| Líneas | 56.92% | 56% |
| Sentencias | 55.61% | 55% |
| Funciones | 51.70% | 51% |
| Ramas | 49.60% | 49% |

Son 2563 fuentes, con 1023 archivos de cobertura de sentencias cero y total
positivo. Los pisos son la parte entera del baseline; no son objetivos finales
ni impiden cualquier caída inferior a ese margen. No se afirma cobertura
80/90% ni se sustituye correctitud/E2E por un porcentaje. Un archivo puramente
de tipos puede tener cero puntos instrumentables y no se cuenta como hueco
de ejecución. El inventario exacto incluye también esos archivos.

Los commits se resolvieron con git ls-remote de los repositorios públicos
oficiales, sin ejecutar su contenido:

- actions/checkout v4: 11d5960a326750d5838078e36cf38b85af677262.
- actions/setup-node v4: 49933ea5288caeca8642d1e84afbd3f7d6820020.
- actions/upload-artifact v4: ea165f8d65b6e75b540449e92b4886f43607fa02.
- actions/download-artifact v4: d3f86a106a0bac45b974a628896c90dbdf5c8093.

El ensayo rojo de la política señaló exactamente 18 referencias mutables. La
configuración final tiene cuatro workflows y 27 referencias, 25 remotas fijas
y dos locales. El barrido no certifica todo el código de Actions, firmas ni
notarización. Referencias: [cobertura Vitest](https://vitest.dev/config/coverage)
y [uso seguro de Actions](https://docs.github.com/en/actions/reference/security/secure-use).

## Verificaciones y riesgos

Pruebas dirigidas de las dos políticas y del YAML de Python, ESLint dirigido y
typecheck; sus resultados finales quedan en recibos. Las negativas intentan
ocultar una fuente sin ejecución, inventar totales/porcentajes, usar valores
NaN/imposibles o pisos inválidos y esconder una Action mutable en un compuesto
local fuera de .github. Revisión propia no sustituye revisión independiente.

No cambian fuentes de producto, IPC, UI, datos o dependencias. El núcleo de
grounding inspeccionado conserva su pendiente; se priorizó este lote por
instrucción del usuario de acelerar impacto transversal. Persisten RLS/IRIS,
claves cliente, coverage funcional restante, CI remoto Node 24, instaladores,
firma/notarización, macOS Intel, accesibilidad y operación. El rechazo GUI
previo se respeta; no se intenta otra vía. No se accede a secretos/.env ni
registros de negocio; sin SQL, stage/commit/push o publicación.

Logs y baseline completos: %TEMP%/soflia-global-quality-2026-10-25/. Respaldos
de archivos previos en before/. Reversión: restaurar sólo el delta de esta
unidad conservando todos los cambios acumulados anteriores.

## Verificación final

verify:pr: catorce etapas, código 0, 372.14 s. Una sola suite Vitest con cobertura:
6053 aprobadas, cinco omitidas; 517 archivos aprobados y dos omitidos (519 total),
235.19 s. Tooling: 62 aprobadas (once nuevas); consumidores dirigidos: 16.
Python 3.12.11: 33 aprobadas. Tipos, harness, runtime, supply-chain y OpenSpec
aprobados; lint incremental: 454 archivos sin deuda nueva. Enlaces: 801 Markdown;
inventario: 704 archivos relacionados con pruebas.

El reporte final V8 contiene exactamente las 2563 fuentes productivas, sin
mocks externos. Inventario, sumas y pisos aprobados; métricas iguales al baseline
productivo: líneas 56.92%, sentencias 55.61%, funciones 51.70%, ramas 49.60%.
Se incluyen los 1023 módulos de sentencias sin ejecutar.

Build: código 0, 74.50 s, pulse-app-build-n2lAdh; seis artefactos no vacíos y
3513 fuentes copiadas con hash coincidente. Enumera 3514 rutas, incluida la
eliminación local preexistente electron/wa-agent/bulk-label-verification.ts,
preservada y omitida al copiar. Sin .env, instalador, inicio de app o publicación.
Persisten avisos del bundler sobre chunks/imports.

Las 3533 fuentes fueron idénticas antes/después de ambos procesos terminales:
SHA256 c665785dda788d496b4440ed33491fbf716ec87c8c0441ddbb08cbc40bffc5b5.
Cambian cinco fuentes existentes y se agregan cinco de tooling/config. .gitignore
añade la exclusión de cobertura generada con recibo separado. No cambia ninguna
fuente src/electron, dependencia o lock. Diff intervenido sin incidencias de
espacios; diez líneas vacías preexistentes fuera del lote permanecen por hash.

Recibos: [regresiones](regression-summary.json), [cobertura](coverage-evidence.json),
[workflows](workflow-evidence.json), [gate](gate-summary.json), [build](build-summary.json),
[fuentes](source-evidence.json), [config](additional-config-evidence.json) y [logs](log-evidence.json).
Auditorías npm repetidas: siete paquetes moderate, cero high/critical. Node local
26.7.0 y Electron 44.9.3; CI Node 24, otros SO, firma y revisión independiente no
se acreditan. Después sólo cambian docs, tareas y reevaluación del índice.

## Reevaluación global

La matriz de once áreas y 44 criterios pasa de 43.25% a 40.875% (40.88%
redondeado): 2.375 puntos menos en este lote y 9.50 frente al 50.375% inicial.
Cobertura medida/umbrales pasa de 75 a 25: el control ahora existe y funciona,
con pisos iniciales y validación remota aún pendientes. Firma/notarización/
inmutabilidad pasa de 75 a 50: referencias inmutables resueltas, certificados
y firma pendientes. Los otros 42 criterios conservan franja. La cobertura
56.92% no se usa como porcentaje de deuda ni se atribuye correctitud global.
[Cálculo y fuentes](../../../../docs/reports/technical-debt-reassessment-2026-10-25.md).
