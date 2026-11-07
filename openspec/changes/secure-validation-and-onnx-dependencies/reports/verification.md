# Validación de dependencias Zod y ONNX

Estado: implementación y verificación final aprobadas; revisión independiente pendiente.
Fecha: 2026-10-24. Unidad 24 acumulativa, rama codex/reduce-technical-debt.

## Evidencia y decisión

Zod raíz 4.4.3 validaba los 1000 hijos de array/set/map aun con cuota dos. Cuatro
regresiones fallaron por 1000 visitas frente a cero esperadas; dos contratos
funcionales pasaron. Fixture pequeño, sin intentar OOM. ONNX 1.27.0 cargaba en
Node, pero traía adm-zip 0.5.18 afectado. Cinco suites consumidoras aprobaron
215 casos antes de resolver dependencias. Baseline local en
%TEMP%/soflia-validation-onnx-2026-10-24.

Se consultaron [advisory Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5),
[advisory de asignación ZIP](https://github.com/advisories/GHSA-xcpc-8h2w-3j85),
[release ONNX](https://github.com/microsoft/onnxruntime/releases/tag/v1.30.0),
[release Zod](https://github.com/colinhacks/zod/releases/tag/v4.6.7) y
[release adm-zip](https://github.com/cthackers/adm-zip/releases/tag/v0.6.1).
Los pins compatibles evitan un override mayor de Jimp/Zod o una rebaja de
bibliotecas de documentos para silenciar auditoría. skip_specs=true corresponde
a mantenimiento de implementación; no se inventó una capacidad funcional.

## Resolución e instalación

Sólo cambiaron cuatro entradas de paquetes: Zod 4.4.3 → 4.6.7, ONNX Runtime y
common 1.27.0 → 1.30.0, adm-zip 0.5.18 → 0.6.1. Global-agent ya estaba en 4.1.3.
Se revisaron lock/metadata/hooks; sólo ONNX declara postinstall, igual que antes.
No se ejecutó ningún hook. CPU Windows está incluido en el tarball; no hizo
falta descargar CUDA/NuGet ni modelos. El default del instalador Linux/x64
continúa contemplando CUDA y no fue ejecutado o cambiado en esta unidad.

npm install --ignore-scripts informó al día, pero dejó versiones físicas antiguas.
Se detectó mediante lectura de paquetes y regresiones aún rojas. Se verificó
ausencia de módulos ONNX cargados en procesos node/electron y las rutas absolutas,
y se movieron sólo los cuatro directorios y el lock oculto a backups temporales.
Reinstalar sin scripts instaló las cuatro versiones esperadas; no se forzó
ningún proceso ni se tocaron dependencias ajenas. La comprobación inicial de
package.json mediante exports falló en common; se usó lectura de ruta física.

[dependency-evidence.json](dependency-evidence.json) compara auditorías del mismo
día: 18 → 16 paquetes afectados, high 10 → 8, moderate 8, sin afectados nuevos;
omit=dev igual. Retira adm-zip y onnxruntime-node; la copia Zod raíz desaparece
de nodos afectados, pero permanecen las dos copias Zod 3 de Jimp. No significa
que se hayan corregido todos los avisos o todas las bibliotecas.

El tarball npm de ONNX 1.30.0 tiene SRI SHA512 igual al lock y npm pack; cinco
binarios win32/x64 instalados coinciden por SHA256 con las entradas del tarball,
leído por streaming sin extraer archivos. [Recibo binario](native-binary-evidence.json).

## Verificación dirigida y nativa

| Caso | Evidencia | Límites |
|---|---|---|
| Colecciones | Seis regresiones Zod reales, cuatro de cuota con cero visitas; transformaciones y schemas de calendario conservados | Fixture 1000 elementos, no benchmark de RAM |
| Consumidores | Seis archivos, 221 casos aprobados tras instalación física; incluye parser visual, voz, Gmail/Project Hub/calendario IPC | Electron simulado en Vitest |
| ZIP | Extracción por entry como el instalador, bytes, CRC, tamaño declarado sin Buffer.alloc anticipado, tamaño cero y error asíncrono único | Cinco comprobaciones compartidas; no todo el instalador NuGet |
| Node/Electron | Trece comprobaciones en cada runtime con versiones reales, Identity CPU, forma/valores/error/release y parser Sharp/letterbox/decode/NMS | Windows x64, sin modelo OmniParser real ni GPU |

`npm run typecheck` y lint enfocado aprobaron. `node --test
scripts/quality/onnx-install-zip.test.mjs` aprobó el contrato compartido; queda
incluido automáticamente en test:quality/verify:pr. El inventario se sincronizó:
680 archivos. `npm run validation:smoke:native` aprobó ambas fases definitivas;
el [recibo nativo](native-summary.json) conserva versiones, checks y perfil.

Los modelos son originales de QA, generados conforme
[ONNX proto](https://raw.githubusercontent.com/onnx/onnx/main/onnx/onnx.proto3),
IR8/opset13, sin pesos/descargas. Identity prueba inferencia numérica. La salida
constante del segundo modelo verifica la integración con el parser, no precisión
de detección. La imagen es sintética. El código main real se transpila para QA;
sólo import.meta.url se adapta a __filename de CommonJS para conservar resolución.
Red HTTP(S)/fetch y webRequest de Electron bloqueados, perfil temporal y sin UI.

## Autorrevisión y correcciones

Se intentó refutar éxito con lock nuevo/binario antiguo, validación de hijos
fuera de cuota, ZIP que aparenta cientos de MiB, inflación con tamaño cero,
CRC inválido, callbacks repetidos, N-API incompatible y cajas incorrectas tras
preproceso/NMS. El guard de Buffer.alloc del propio QA impide una asignación
superior a 1 MiB si regresa el defecto; no se presenta como política de memoria
del runtime. Se restaura en finally antes de cargar el nativo.

El primer fixture CRC modificaba sólo el directorio central aunque esta entrada
sin descriptor valida CRC local: no demostró corrupción del payload. Se corrigió
la pareja de CRC para probar contenido inválido; el rechazo real pasó. Después Node
aprobó, pero Electron encontró EEXIST porque la carpeta de resultados electron
coincidía con las fuentes compiladas. El arnés acabó por su timeout; se separaron
qa-node/qa-electron y ambas fases pasaron. No se amplió plazo ni tolerancia, ni
se modificó el producto para acomodar un fixture. No se repitió un proceso vivo.

Las copias transitivas Zod 3 y los demás avisos siguen abiertos. Sólo la sesión
directa de inferencia tiene release explícito en este QA; la sesión interna del
parser mantiene lifecycle existente y termina con el proceso de smoke. No se
certifica carga prolongada, detector real, otras plataformas, instalador, firma,
CUDA, CI remoto o despliegue. Esta es autorrevisión; revisión independiente
pendiente antes de archivar. No hubo SQL, .env, credenciales, captura/control del
escritorio, publicación o modificación del store del SO.

Recuperación: conservar backups, pins/cierre/binarios coherentes y corregidos;
evaluar selectivamente otra versión parcheada y repetir consumidores/nativo/gate.
No deshacer las 23 unidades anteriores ni restaurar versiones vulnerables para
obtener un verde. No se recalcula el índice global experto a partir de avisos.

## Verificación final

La autorrevisión ejecutó también el contrato ZIP contra el backup 0.5.18 en un
proceso Node separado con límite de heap y guard Buffer.alloc de 1 MiB. El archivo
propio declara 128 MiB, pero el guard interceptó la asignación antes de llamarla;
no se asignaron esos 128 MiB. La misma comprobación aprobó en 0.6.1 sin activar
el guard. [Recibo del rechazo anterior](legacy-zip-guard.json). La sustitución
de resolución del módulo existió sólo en ese proceso de QA, sin modificar las
dependencias instaladas o las fuentes congeladas de la compuerta.

`npm run verify:pr` completó sus trece etapas con exit 0: 5747 casos Vitest
aprobados y cinco omitidos; 503 archivos aprobados y dos omitidos (505 total),
189.00 s. Además 23 pruebas de tooling y 33 contratos Python con standalone
3.12.11. Lint incremental revisó 311 archivos sin deuda nueva y enlaces de 722
Markdown activos válidos. Se conservaron los 5741 casos aprobados anteriores
y se agregaron seis; el contrato ZIP adicional cuenta en tooling, sin sumarlo
otra vez a Vitest. [Recibo de compuerta](gate-summary.json).

`npm run app:smoke:build` aprobó en wmyPVH: 3457 fuentes copiadas y seis artefactos
no vacíos, sin .env ni empaquetado. Doce fuentes relevantes copiadas coinciden
por SHA256 con el worktree. Las 3476 fuentes de build/Python/workflows y la
configuración ESLint, con su inventario, quedaron idénticas durante gate/build.
Los cambios posteriores sólo registran evidencia y documentación/tareas.
[Build](build-summary.json), [fuentes](source-evidence.json) y
[hashes de logs](log-evidence.json). Los avisos de chunks/inlineDynamicImports
del bundler permanecen visibles; el build no demuestra un presupuesto de rendimiento.

Node local 26.7.0; CI configurado con 24 no ejecutado aquí. Electron 44.9.3 fue
comprobado por runtime:stable y por el smoke real. Se mantienen explícitos los
límites de plataformas/modelos y revisión independiente; la unidad no se archiva.
