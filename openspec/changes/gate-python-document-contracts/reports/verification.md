# Contratos Python integrados a la verificación

Estado: implementación, pruebas dirigidas, gate final y build aprobados.
Revisión independiente y ejecución remota pendientes. Sin archivar.
Fecha local: 2026-10-24. Rama: codex/reduce-technical-debt.

## Resultado y alcance

verify:pr incorpora python-tools:test como etapa obligatoria. El wrapper exige
Python 3.12.x, usa un override absoluto o comando del SO, probe acotado y modo
aislado sin site-packages para contratos puros. Falla ante intérprete ausente,
versión incompatible, error, señal o timeout; no hace descargas ni omite casos.
--formats reutiliza el runner con las bibliotecas/locks exactos, sin instalarlas.
Su entorno allowlisted omite PYTHONPATH, PYTHONHOME y variables ajenas; no se
modifica .env, preferencias, PATH local ni runtime de producto.

El preparador de QA usa las mismas URL/SHA256 de Python standalone fijadas por
el proyecto y comparte la descarga HTTPS acotada con setup. Verifica hash antes
de tar y patch/arquitectura después, guarda recibo en temporal y nunca promueve
el runtime. Sólo --github-actions emite SOFLIA_TEST_PYTHON en GITHUB_ENV, y exige
contexto CI. No acepta overrides de URL/hash para esta preparación de QA.

Se encontró que actions/python-versions ofrece 3.12.11 sólo para Linux, confirmado
en su manifiesto primario y [reporte del proyecto](https://github.com/actions/setup-python/issues/1150).
El preparador standalone permite usar el patch del producto también en Windows
y macOS, sin sustituirlo por uno más fácil de instalar. Corrige el wiring del
workflow candidato Intel de la unidad anterior; no lo ejecuta ni aprueba un
artefacto de cryptography por esa corrección.

CI y release llaman a la matriz reutilizable de formatos para Windows x64,
macOS ARM64 y Ubuntu x64/ARM64; builds dependen de ella y del gate para el mismo
SHA. Los labels se contrastaron con la
[referencia GitHub](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
Cada job prepara Python exacto, valida SO/arquitectura, crea venv temporal,
instala bootstrap/lector con hashes y sólo wheels, ejecuta pip check y formatos.
Actions nuevas están fijadas por SHA, checkout no conserva credenciales y los
permisos son contents:read. No hereda secretos, publica o descarga modelos.

## Evidencia local y matriz

| Garantía | Evidencia |
| --- | --- |
| Selección explícita, aislamiento, modos, error/timeout nunca dan verde | python-tools-test.test.mjs |
| Hash erróneo no llega a tar/ejecución y target no soportado no descarga | prepare-test-python.test.mjs |
| HTTP/exceso de redirecciones rechazados antes de escritura | python-runtime-download.test.mjs |
| Gate, callers CI/release, necesidades de build y matriz con locks/permisos | python-workflows.test.mjs, YAML parseado |
| Python ausente falla realmente con exit 1 y ayuda accionable | missing-python.log |
| Intérprete real descargado/verificado, sin promoción | prepare-real.log y recibo temporal |
| Contratos puros sin bibliotecas | stdlib-wrapper.log: 33 aprobadas en QA 3.12.14 |
| Formatos/privacidad/presupuesto/stdio con pins y patch del producto | formats311.log: 33 stdlib + 15 formatos en 3.12.11 |
| Instalación compatible del lector exacto | bootstrap311/readers311 y pip-check311.log |

Los 14 casos de tooling pasaron; también 66 regresiones de preparación y
empaquetado en dos archivos TS. Stdlib con el preparador final pasó 33 casos
en 3.12.11 (stdlib311-final.log). wrapper-red.log
registró módulo ausente antes de implementarlo; workflow-red.log reprodujo los
cuatro contratos de wiring sin configurar. No se presentan esos fallos como
exploits ni como ejecución de CI. Los formatos reales usan Windows x64 y un
venv temporal con quince paquetes del lector; no certifican voz ni instalador.

yaml 2.9.0 se declara directamente en dev para leer contratos de workflows,
evitando depender de una transitiva implícita; ya estaba instalada, licencia ISC
y sin hooks de instalación. Se resolvió --package-lock-only --ignore-scripts;
comparando el lock anterior del build mEWb1K no hay versiones/integridades nuevas
o eliminadas. Auditoría antes/después: mismos veinte paquetes afectados,
doce high y ocho moderate, sin afectados nuevos. No se deduce que esos veinte
sean fallos explotables independientes. Avisos residuales siguen pendientes.

## Autorrevisión y límites

Se intentó refutar verde falso sin Python, fallback a otro intérprete pese a
override inválido, herencia de configuración Python, hashes previos a efectos,
arquitectura de runner incorrecta y builds que omiten la matriz. La inspección
detectó setup-python 3.12.11 no disponible en macOS/Windows antes de confiar en
ese YAML: se sustituyó por el preparador con pin compartido. Los comandos de
workflow usan SOFLIA_TEST_PYTHON explícito, evitando aliases python del host.

Lint detectó la extracción inicial CommonJS fuera de las entradas conocidas;
el módulo compartido se convirtió a ESM y setup lo carga dinámicamente, sin
ampliar excepciones ESLint. El setup conserva staging, validación, respaldo y
fingerprint. Se preservan las veinte unidades previas y worktrees ajenos.

Esta es autorrevisión, sin agente independiente. No hubo dispatch, push, PR,
release, secretos, SQL, cuentas, audio, modelos, perfiles o runtime real
modificados. La matriz y candidato Intel siguen sin ejecución remota; macOS
Intel sigue sin wheel aprobada. Timeout del wrapper acota su hijo directo; no
se certifica supervisión de todo el árbol del SO tras un kill externo.

Reversión: retirar wiring de gate/callers y herramientas de esta unidad,
manteniendo coherentes helper de descarga y setup. Conservar locks y barrera
PDF anteriores. No recalcular deuda global por número de tests o líneas.
Logs locales: %TEMP%/soflia-python-gate-2026-10-24.

## Resultado final

La primera compuerta detectó inventario documental desactualizado (670 frente a
674 archivos). Se esperó el cierre del build antes de regenerarlo con
docs:inventory:sync; sólo cambió documentación. La segunda compuerta completó
sus doce etapas con exit 0: 5690 casos Vitest aprobados y cinco omitidos, 498
archivos aprobados y dos omitidos (500 total), 230.78 s; además 18 casos de
tooling y 33 contratos Python reales con standalone 3.12.11. Lint incremental
revisó 302 archivos sin deuda nueva y validó enlaces de 704 Markdown activos.
Ver gate-summary.json. Son cifras del worktree acumulado, sin atribuir toda
su cobertura a esta unidad. CI usa Node 24; el host local usó Node 26.7.0.

Build Diw326 aprobado, con 3443 fuentes copiadas y seis artefactos no vacíos.
Ocho fuentes relevantes del sandbox coinciden por SHA256 con el worktree;
las 3461 fuentes registradas de build/Python/workflows permanecieron estables.
Ver build-summary y source-evidence JSON. La corrección posterior del inventario
no altera entradas del build. No se ejecutó empaquetado ni arranque de la app.

Las pruebas negativas reales devolvieron exit 1 ante intérprete ausente y ante
--formats con Python sin dependencias de lector; ese fallo no se omitió. El
caso positivo con venv y ambos locks aprobó 48 pruebas bajo Python 3.12.11 y
pip check sin conflictos. Descargar/verificar el intérprete y probar parsers
locales no demuestra voz, otros SO o resultado de Actions. Se conservan las
brechas remotas/Intel y no se recalcula el índice global.
