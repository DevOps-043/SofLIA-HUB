# Cierre de dependencias de exportación documental

Estado: implementación y verificación final aprobadas; revisión independiente pendiente.
Fecha: 2026-10-24. Unidad 25 acumulativa, rama codex/reduce-technical-debt.

## Diagnóstico y alcance

Los padres más recientes consultados siguen siendo ExcelJS 4.4.0 y PptxGenJS
4.0.1. El primero llama únicamente uuid.v4() sin argumentos en CfRuleExtXform;
los bundles CJS/ESM del segundo sólo importan JSZip y no image-size. Una mención
sizeof está comentada. Los consumidores Excel del producto están en main;
no se encontró importación ExcelJS/PptxGenJS en src. La copia browser incluida
en el paquete ExcelJS no se modifica por un override transitivo y no se presenta
como parcheada. [Inspección de consumidores/bundles](parent-api-evidence.json).

Se consultaron [advisory UUID](https://github.com/advisories/GHSA-w5hq-g745-h8pq),
[ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr),
[API UUID 11](https://github.com/uuidjs/uuid/blob/v11.1.1/README.md) y
[API/mantenimiento image-size](https://codeberg.org/image-size/image-size).
El aviso UUID no demuestra que el caller v4 usado por Excel sea explotable.
Tampoco se atribuye al Hub la ejecución de un parser que su padre no importa.

Antes del cambio, v5 aceptó Buffer de un byte sin error. Un ICNS propio de 16
bytes y entry de longitud cero hizo 33 pushes sin avanzar; una guarda de QA
detuvo el caso antes de crecimiento indefinido. Fue un proceso Node separado
con heap acotado, sin Hub ni archivos ajenos. Cuatro suites consumidoras aprobaron
71 casos. [Baseline y cierre](dependency-evidence.json).

## Resolución y compatibilidad

Se fijaron los padres a sus versiones instaladas y se limitaron overrides a
exceljs@4.4.0 → uuid 11.1.1 y pptxgenjs@4.0.1 → image-size 2.0.4. No hay override
global, shim de producto, fork, edición de node_modules ni rebaja del generador.
UUID 11 conserva CJS/ESM y v4 sin argumentos; image-size 2 usa buffer y fromFile
separados. Se documenta retirar el selector al adoptar un cierre oficial seguro
del padre, con nueva revisión de API/lock/consumidores. No extenderlo a versiones
no probadas. Esta compatibilidad específica no afirma que toda API de las
mayores sea intercambiable. Política en
[desarrollo](../../../../docs/operations/development-and-devops.md#actualizaciones-de-dependencias).

Resolver el lock con ignore-scripts cambió sólo uuid e image-size y retiró queue,
que quedó sin consumidores. La instalación sin hooks cambió físicamente esos
dos paquetes y retiró queue; no requirió reparación del lock oculto ni movimientos
manuales. Los SRI y versiones físicas coinciden con el cierre registrado.

Auditoría comparable completa y omit=dev: 16 a 12 paquetes afectados; high 8 a 6,
moderate 8 a 6, sin afectados nuevos. Retira entradas UUID, ExcelJS, image-size y
PptxGenJS del informe npm. Son paquetes relacionados por el mismo cierre, no
cuatro exploits independientes ni un porcentaje de deuda. Jimp y sus transitivas
siguen pendientes; no se declara el árbol seguro en su totalidad.

## Pruebas ejecutadas

| Frontera | Evidencia real | Límite |
|---|---|---|
| UUID | CJS/ESM, v4 únicos/válidos, v5 con buffer corto/offset negativo rechazados, buffer válido conservado | No ejercita todas las APIs UUID |
| Imagen | PNG/JPEG CJS/ESM y lectura de archivo, SVG, formato desconocido, ICNS cero rechazado sin disparar guarda | Fixtures pequeños propios |
| XLSX | Dos CF extendidos con IDs v4 únicos y referencias pareadas; fórmula/result, Unicode e imagen conservados tras relectura | No visualiza Excel instalado |
| PPTX | CJS con texto/imagen/chart editable, generación ESM y lectura de OOXML | No certifica representación de PowerPoint |
| Word | ZIP/OOXML con texto español conservado | Regresión del consumidor, no parche de docx |
| Hub | Exportador main real compilado: diapositiva con texto/notas, conteo y rechazo de array vacío | No cambia UI o contrato IPC |

`node --test scripts/quality/document-export-dependencies.test.mjs` aprobó dos
contratos, incluidos automáticamente en test:quality. Los 71 casos consumidores
volvieron a aprobar después de la instalación; lint enfocado aprobó. Inventario
sincronizado con docs:inventory:sync: 681 archivos.

`npm run document-export:smoke:native` aprobó once comprobaciones en Node y once
en Electron 44.9.3 Windows/x64. [Recibo y doce artefactos](native-summary.json)
conserva hashes de DOCX/XLSX/PPTX/PNG/JPEG. El exportador se compila con Vite
directo declarado, configuración y cache propias temporales, sin .env ni secretos;
los procesos reciben sólo entorno permitido. Red Node HTTP(S)/fetch y webRequest
Electron bloqueados; sin cuentas ni Office real. Los perfiles son efímeros y no
se carga el bootstrap del Hub. Las repeticiones finales usaron el script final.

## Autorrevisión adversarial y límites

Se intentó refutar override aplicado a un consumidor no probado, éxito basado
sólo en lock, incompatibilidad CJS/ESM o API archivo/buffer, GUID válidos pero sin
referencias, fórmula/imagen perdidas, parser ICNS que sigue sin avanzar y empaquetado
PPTX sin gráfica. Los fixtures comprueban contenido y relaciones, además de
existencia/tamaño. La guarda de Array.push es sólo QA síncrono y se restaura en
finally; no se presenta como control de memoria del producto.

Se corrigió durante revisión la comprobación de versiones nativas: esperaba
valores leídos de la instalación y los comparaba con esa misma instalación.
El script final deriva versiones de pins/overrides del manifiesto, exige pins
exactos y compara contra paquetes físicos. No hubo fallos funcionales ni se
ampliaron plazos/tolerancias para aceptar los overrides. El aviso experimental
localStorage de Node permanece visible, sin convertirlo en omisión de tests.

La aprobación local no acredita render visual, otros SO, CI remoto, instalador,
distribuciones ya publicadas o todo el código embebido en bundles de terceros.
Revisión independiente pendiente antes de archivar. No hubo SQL, .env, datos
reales, envío de archivos/mensajes, captura/control de escritorio, commit, push
o despliegue. Los bloqueos backend IRIS e Intel Python conservan su estado.

Recuperación: conservar manifiesto/lock coherentes y revisar otro cierre parcheado
con estos contratos; retirar overrides al actualizar padres de forma demostrada.
No reactivar bibliotecas afectadas sólo para pasar una prueba ni deshacer las 24
unidades previas. No se recalcula el índice global de deuda desde npm audit.

## Verificación final

`npm run verify:pr` completó trece etapas con exit 0: 5747 casos Vitest aprobados
y cinco omitidos; 503 archivos aprobados y dos omitidos (505 total). Se conserva
el mismo conjunto Vitest anterior; las dos regresiones nuevas son de tooling,
que pasó de 23 a 25 casos, sin sumarlas otra vez a Vitest. También aprobaron 33
contratos Python con standalone 3.12.11, tipos, harness y lint incremental de
311 archivos sin deuda nueva. Lint enfocado cubrió además los scripts/fixtures
JS nuevos. Enlaces válidos en 727 Markdown activos.
[Recibo de compuerta](gate-summary.json).

La suite tardó 543.59 s, frente a 189 s en la unidad anterior. Durante la espera
se revalidaron el handle del runner y workers nuevos con CPU activa; se esperó
la misma ejecución hasta su salida, sin reiniciarla ni ampliar timeouts o workers.
La diferencia observada no permite aislar una causa ni se presenta como benchmark
del producto. No hubo fallos u omisiones adicionales.

`npm run app:smoke:build` aprobó en u1bBX0: 3461 rutas enumeradas por Git y seis artefactos
no vacíos, sin .env, empaquetado o arranque del Hub. Ocho fuentes seleccionadas
copiadas coinciden por SHA256. Las 3480 fuentes/inventario de build/Python/workflows
y configuración ESLint permanecieron idénticas durante ambas comprobaciones.
También se revalidaron versiones físicas y hashes de los bundles/consumidores
inspeccionados. Los cambios posteriores sólo registran evidencia/tareas.
[Build](build-summary.json), [fuentes](source-evidence.json) y
[hashes de logs](log-evidence.json).

Node local 26.7.0 y Electron 44.9.3; CI Node 24 no ejecutado aquí. Los avisos de
chunks/inlineDynamicImports del bundler permanecen visibles; no se alteraron
sus umbrales. La unidad queda sin archivar hasta revisión independiente.
