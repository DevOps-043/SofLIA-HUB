# Dependencias verificadas del lector Python

Estado: implementación local, pruebas dirigidas, compuerta final y build
aprobados. Unidad parcial: macOS Intel sigue pendiente. Sin archivar.
Fecha local: 2026-10-24. Rama: codex/reduce-technical-debt.

## Problema, alcance y resultado

pdfplumber 0.11.4 fijaba pdfminer.six 20231228, afectado por CVE-2025-64512 y
CVE-2025-70559 según los avisos del mantenedor. La resolución anterior se
inspeccionó sin instalar/ejecutar la versión vulnerable. Baseline: 5450 pruebas
TS aprobadas, cinco omitidas y 34 Python con dependencias QA diferentes.

El lock actual fija quince paquetes del lector, incluidos pdfplumber 0.11.10,
pdfminer.six 20260107 y python-docx 1.2.0, con 616 SHA256 de wheels oficiales no
retiradas. El entrypoint referencia el lock. Actualiza también bootstrap
setuptools 84.2.1, wheel 0.48.0 y packaging 26.3, con lock propio: los dos
primeros pins anteriores también tenían avisos publicados. Audit-summary
registra versiones, aliases y fuentes, sin copiar los textos de explotación.
Cuatro IDs del pdfminer anterior corresponden a dos CVE, no cuatro fallos.
No hubo avisos publicados en los quince pins nuevos ni los tres de bootstrap
al consultarlos; esto no es una auditoría de todo voz/Node ni de fallos inéditos.

Setup conserva staging, validación y respaldo. Instala bootstrap hashed, voz
por separado y lector hashed/sólo wheels; no mezcla voz con un falso lock
transitivo. Pip check, versiones exactas de lector/bootstrap e imports completos
preceden a la promoción. Fingerprint de setup y smoke incluye cuatro archivos:
requisitos voz, entrypoint lector, lock lector y lock bootstrap. Verificador de
empaquetado comprueba todos los módulos obligatorios y usa la política del
sidecar empaquetado. No se ejecutó empaquetado ni promoción del runtime real.

Antes de importar el parser PDF, versiones antiguas, ausentes o inverificables
fallan con DEPENDENCY_INCOMPATIBLE y mensaje público fijo. Es una comprobación
de metadata, sin pretensión de detectar una instalación maliciosamente alterada.
API, DTO, privacidad, cuotas y separación main/preload/renderer se conservan.

## Matriz y evidencia local

| Garantía | Evidencia |
| --- | --- |
| PDF vulnerable/missing/inválido rechazado sin invocar parser | test_reader_dependencies, guard-red.log y python-final.log |
| Lock malformado, duplicado, sin hash y versiones divergentes rechazados | test_reader_dependencies |
| Caché cambia con lock o bootstrap aunque no cambie entrypoint | python-runtime-support y fingerprint-red.log |
| Recursos obligatorios e imports después de política | verify-packaged-python y python-runtime-support |
| Hash incorrecto no se instala | hash-rejected.log: exit 1 esperado, wheelhouse temporal |
| Formatos, PII, presupuesto y stdio reales ficticios con pins exactos | runner --formats en venv temporal Windows |
| Resolución e instalación conjunta con voz | joint-pip-report y voice-install-report temporales; pip check e imports finales |
| Guardas de builder sin compilar | test_reader_native_build: fuente/hash, rutas/enlaces/duplicados, linkage y host |

33 unittest stdlib pasan también con site-packages deshabilitado; --formats
comprueba los dos locks y añade 15 casos reales: 48 aprobadas sin omisiones.
Se usó CPython QA 3.12.14; el runtime distribuible fija 3.12.11, diferencia
pendiente de certificación nativa. La instalación temporal de voz completa
terminó, sus imports junto al lector pasaron y pip check final terminó sin
conflictos. No se descargaron modelos ni se abrió audio. 106 casos TS dirigidos
en seis archivos pasaron; un filtro anterior sólo seleccionó cinco archivos
existentes (85 casos) y no se presenta como cobertura adicional.

La compuerta final completó sus once etapas con exit 0: 5690 pruebas TS
aprobadas, cinco omitidas; 498 archivos aprobados y dos omitidos (500 total),
225.96 segundos. Lint incremental revisó 302 archivos sin deuda nueva y los
enlaces de 699 Markdown activos fueron válidos. Estas cifras describen el
worktree acumulado; no se atribuye toda su diferencia a esta unidad.
Ver gate-summary.json. Typecheck y lint enfocado también terminaron con exit 0.

Build aislado mEWb1K aprobado: 3436 fuentes copiadas, seis artefactos no vacíos
y seis fuentes relevantes con SHA256 igual al worktree. Las 3451 fuentes
registradas de build/lector permanecieron estables durante ambas verificaciones;
se recomprobaron además las 60 entradas de wheels descargadas. Ver build-summary,
source-evidence y log-evidence JSON. El primer intento de inventario consultó
una ruta de presentación equivocada; se corrigió leyendo la lista real del
smoke y se comprobaron los seis artefactos existentes. No falló el build.
No acredita instalador, arranque ni runtime Python distribuible.

Comandos reproducibles: intérprete elegido con
`-I -S -B -X utf8 python/tools_sidecar/tests/run_tests.py` para contratos puros;
sin -S y con --formats en venv que tenga ambos locks instalados para formatos.
Instalar lector con pip aislado, --require-hashes, --only-binary=:all: y -r del
entrypoint. Bootstrap usa las mismas opciones y su lock; voz mantiene el paso
separado --no-build-isolation de setup. Logs locales bajo
`%TEMP%/soflia-reader-dependencies-2026-10-23`.

## Plataformas y límite pendiente

Se descargaron y comprobaron wheels para Windows x64, macOS ARM64, Linux x64 y
Linux ARM64 (60 entradas, 33 archivos únicos); ver wheel-artifacts.json. Descarga
no equivale a ejecución en esos SO. Sólo Windows tuvo instalación y pruebas.
Metadata del lock incluye wheels adicionales oficiales para sus versiones;
no se afirma haber ejecutado ni descargado todos los 616 hashes.

cryptography 50.0.2 no publica wheel macOS Intel. 48.0.1 la ofrece, pero tiene
avisos; no se rebajó. El usuario confirmó no disponer de entorno Intel. La
preparación de ese target falla sin promover ni borrar su runtime previo; 1.2
sigue abierta. El workflow macos-15-intel, con permisos contents:read, checkout
sin credenciales y fuentes limitadas, construirá sólo un candidato: fuentes
cryptography/OpenSSL con SHA256, Rust fijado, OpenSSL estático, comprobación de
target/linkage, pip check y formatos antes de guardar wheel/licencias/recibo.
No se ejecutó este job, no existe un artefacto nativo aprobado y no se añadió
un hash inventado. Rust/cargo y el proveedor CI conservan riesgos de suministro.
El builder no modifica el lock del repo ni publica/promueve distribuciones.

## Autorrevisión y recuperación

Se intentó refutar invalidación de caché, instalación con bytes incorrectos,
aceptación de PDF antiguo, orden de imports, recursos ausentes y falsa cobertura
multiplataforma. La revisión añadió bootstrap al fingerprint/validación,
verificación del sidecar empaquetado y rechazo de rutas tar duplicadas antes de
extraer. El workflow se inspeccionó y parseó, sin tratarlo como ejecutado.

Revisión independiente pendiente antes de archivar. Persisten macOS Intel,
ejecución nativa por plataforma, patch CPython, dependencias/modelos de voz
fuera de auditoría integral y la deuda global/IRIS descrita en el plan.
No se tocaron secretos, .env, perfiles, runtime instalado, SQL ni cuentas;
no hubo commit, push, despliegue o release. Las diecinueve unidades previas se
conservan. Reversión: mantener barrera PDF y sustituir pins por otro cierre
verificado; no aceptar de nuevo pdfminer vulnerable ni certificar instalaciones
desplegadas por cambiar este repositorio. No se recalculó el índice global.
