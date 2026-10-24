# Verificación de dependencias

Estado: implementación verificada localmente; pendiente de revisión independiente.
Fecha: 2026-10-22.
Rama: codex/reduce-technical-debt. Base Git:
e166d250629e503cf12f69449fb6d66e569134c8. Se conserva la unidad anterior.

## Resultado

| Auditoría npm | Antes | Después |
|---|---:|---:|
| Paquetes afectados totales | 45 | 28 |
| Severidad high | 20 | 9 |
| Severidad moderate | 25 | 19 |
| Paquetes afectados, omitiendo dev | 26 | 17 |
| High, omitiendo dev | 11 | 5 |
| Moderate, omitiendo dev | 15 | 12 |
| Avisos únicos por URL, árbol completo | 77 | 22 |

La cantidad de paquetes afectados disminuye 37,8% y los de severidad alta 55%.
No aparecen paquetes ni URLs de avisos nuevos. npm audit sigue saliendo con
código 1 por los pendientes. Los conteos describen paquetes y avisos, no
exploits demostrados ni un porcentaje global nuevo de deuda.

## Cambios y comprobaciones

- Sharp 0.35.3 → 0.35.5; Vite 8.2.1 → 8.2.4; Vitest/coverage 4.1.10 → 4.1.12.
  Se fijan estas versiones directas y el lock completo conserva hashes.
- Transitivas actualizadas dentro de sus rangos, sin overrides nuevos.
  No se cambia el lock aislado de Zoom ni se ejecutan ganchos de instalación.
- `audit:supply-chain`: aprobado, sin ganchos nuevos/reemplazados.
- Consumidores focalizados: 81 pruebas aprobadas antes y 81 después de instalar
  físicamente las versiones nuevas. Incluyen imágenes reales, Word, PPTX y XLSX.
- `npm ls --all --json`: salida 0, sin problems. Comparación física de los
  48 registros modificados instalados en este host: sin discrepancias.
- Sharp cargado: 0.35.5, libvips 8.18.7, librsvg 2.63.2.

La primera instalación confiaba en metadata del lock oculto y mantenía archivos
anteriores: sus pruebas no se cuentan como validación de los parches. Se conservó
el lock oculto y se regeneró la instalación sin scripts. Hubo un error transitorio
de Windows al escribir el lock raíz; el contenido seguía intacto y el reintento
terminó con salida 0. Las comprobaciones físicas y focalizadas son posteriores.

## Verificación integral

El primer `npm run verify:pr` con las dependencias instaladas aprobó: 4476 pruebas,
5 omitidas, 0 fallos (206,16 s), además de tooling, tipos, lint, harness, documentos
y OpenSpec. Es anterior a la reparación adicional del smoke; se repite el gate
para registrar evidencia del estado final.

La revisión detectó que el smoke no copiaba tres configs Vite auxiliares ni las
seis entradas de Zoom. La nueva regresión reprodujo 9 fallos (58 casos existentes
y negativos aprobados), y tras reparar el filtro pasan sus 67 casos. ESLint del
script también aprobó. El smoke exige ahora artefactos no vacíos de main,
preload, renderer, presentaciones, audiovisual y Zoom. Se mantienen la allowlist
acotada y la exclusión de configuración local, node_modules y secretos.

El gate final `npm run verify:pr` **aprobó con salida 0** tras reparar el smoke:
436 archivos aprobados, 2 omitidos; **4492 pruebas aprobadas, 5 omitidas y
0 fallos** (205,15 s). Se mantienen los timeouts y omisiones anteriores. Las
16 nuevas regresiones del smoke se incluyen en esta ejecución. También pasan
tooling, tipos, lint incremental, harness, documentos y OpenSpec.

Evidencia resumida: [verification.json](verification.json).

## Compilación aislada

`npm run app:smoke:build`: salida 0. Se copiaron 3258 fuentes, sin .env, y se
generaron artefactos no vacíos de renderer, main, preload y los tres runtimes
auxiliares. El [resumen del build](build-summary.json) conserva timestamp,
directorio temporal, tamaños y SHA-256. El lock raíz y el lock de Zoom del
checkout no se modificaron durante el build. La instalación aislada del SDK
Zoom deshabilitó scripts y reportó cero avisos en su árbol de 21 paquetes.

Se mantienen avisos de tamaño de chunks y carga mixta CommonJS/ESM. No se
elevaron presupuestos ni se ocultaron advertencias para conseguir salida verde.
No se inició la aplicación ni se generaron instaladores.

## Revisión adversarial

Autorrevisión, sin presentarla como revisión independiente. Se revisaron:
versiones físicas frente a metadata, componentes nativos cargados, overrides,
ganchos y origen/integridad de nuevas descargas, rangos de consumidores,
contratos documentales y exclusión de rutas sensibles en el smoke. Los hallazgos
de metadata obsoleta y fuentes omitidas se corrigieron antes de aceptar la
evidencia final. No se añadieron dependencias directas, canales, permisos o
almacenamiento; la arquitectura main/preload/renderer mantiene sus contratos.

## Fuentes y límites

Consulta del registro npm y fuentes primarias revisadas:
[Sharp/librsvg](https://github.com/advisories/GHSA-wq5f-xc86-pv6w),
[Vitest/mocker](https://github.com/advisories/GHSA-82fw-gwwq-j7x9),
[Vite](https://github.com/advisories/GHSA-9jrq-w75r-8gcw).
La actualización de Vitest también cubre el aviso de inyección posterior a
4.1.11 reflejado en audit. No se ejecutaron payloads de explotación.

Quedan avisos en correo/ONNX/documentos/automatización y empaquetado, además de
la herramienta OpenSpec. Requieren revisar nuevos contratos o versiones de sus
productores; no se fuerza un downgrade ni un override de major para ocultarlos.
El [reporte JSON](audit-comparison.json) registra el conjunto exacto residual,
los 87 registros del lock modificados y sus versiones. Todas las descargas
modificados provienen de registry.npmjs.org y conservan integridad; no hay paquetes
directos ni ganchos nuevos. Un registro nuevo es el binding opcional Android de
Rolldown; forma parte de su distribución y no cambia los destinos del producto.

Consumidores residuales comprobados con `npm explain`:

| Dependencia pendiente | Consumidor que la limita |
|---|---|
| adm-zip 0.5.18 | onnxruntime-node 1.27.0, rango ^0.5.16 |
| image-size 1.2.1 | pptxgenjs 4.0.1, rango ^1.2.1 |
| uuid 8.3.2 | exceljs 4.4.0, rango ^8.3.0 |
| sprintf-js 1.0.3 / 1.1.3 | argparse 1.0.10 / roarr 2.15.4 |
| braces 3.0.3 | micromatch 4.0.8, rango ^3.0.3 |
| global-agent 3.0.0 | @electron/get 3.1.0; ONNX usa otra versión 4.1.3 |

Sólo se verifica Windows localmente, con Node 26.7.0/npm 11.19.0. CI permanece
en Node 24 y no se ejecutó remotamente. No se afirma validación de ABI
Linux/macOS ni instalador distribuido.

Rollback: restaurar únicamente manifest/lock previos de esta unidad y reinstalar;
preservar test:quality y el resto del bloque anterior. Reintroduce avisos conocidos.
Sin cambios de datos, secretos ni despliegues. Sin revisión independiente ni archivo.

Logs temporales: C:/Users/fysg5/AppData/Local/Temp/soflia-debt-dependencies-2026-10-22.
