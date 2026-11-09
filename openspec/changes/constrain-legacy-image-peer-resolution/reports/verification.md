# Resolución de peers de imágenes

Estado: evidencia histórica de verificación local; revisión independiente pendiente.
Fecha: 2026-10-25.

## Resultado y alcance

Overrides sólo bajo scale/shadow 0.22.12 fijan sus peers resize/blur 0.22.12 del
conjunto Jimp que usa nut-js/shared 4.2.6. Sin nuevas dependencias directas, APIs,
IPC, permisos, datos ni bootstrap. Manifiesto/lock respaldados en
`%TEMP%/soflia-image-dependencies-2026-10-25/`; la rama acumulativa y otros
worktrees se preservan. Sin stage, commit, push, despliegue, SQL o secretos.

La auditoría anterior tenía doce paquetes afectados (seis high/seis moderate).
La nueva tiene siete moderate y cero high. El mismo resultado se observa con
`--omit=dev`. No hay paquetes/nodos afectados nuevos: core pasa de high a
moderate, lo que explica seis a siete moderate. Los avisos directos pasan de
dos a uno; no se confunden con paquetes propagados ni explotabilidad.

Se retiraron veinte paquetes y cambiaron tres, sin adiciones al lock. Parte de
las retiradas son duplicados 0.22 deduplicados, no veinte vulnerabilidades.
Se conserva file-type 16.5.4 y su cadena; esta unidad no declara parser seguro.
Fuentes primarias: aviso [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
y [file-type](https://github.com/advisories/GHSA-5v7r-6r5c-r473).

## Contratos y evidencia dirigida

- `contracts-before.log`: una regresión de resolución fallida (resize 1.6.1 bajo
  scale 0.22.12) y dos contratos funcionales aprobados. El constructor actual
  Jimp funcionaba; no se inventa una caída del Hub.
- `contracts-after.log`: los tres contratos pasan tras instalar físicamente.
  Comprueban PNG por buffer/archivo con RGBA exacto y alpha mediante decodificador
  Sharp, JPEG por dimensiones, scale/resize/blur/shadow y rechazo inválido.
  Los proveedores reales nut-js prueban escritura/lectura, RGB/BGR, colorAt y
  coordenadas/archivo inválidos; no se importa su bootstrap nativo.
- `npm install --package-lock-only --ignore-scripts --no-audit`, revisión del
  delta y `npm install --ignore-scripts --no-audit`: ganchos sin cambios.
- Tarballs npm verificados por SRI SHA512 contra el lock; sus 46 archivos
  coinciden por SHA256 con plugin-blur/plugin-resize/utils físicos. Los veinte
  paths retirados ya no existen; npm ls completo no informa conflictos.

La auditoría de producción anterior se obtuvo de una copia exacta del manifiesto
y lock respaldados antes del cambio, auditada sin instalar la versión anterior.
La primera inspección PowerShell del delta no interpretó la clave vacía del lock;
su salida vacía se descarta. El inspector Node corrigió la lectura y exige los
únicos dos overrides añadidos y tres entradas modificadas. Recibos:
[dependencias](dependency-evidence.json), [regresiones](regression-summary.json).

## Verificación con el runtime distribuido

El runner `node scripts/quality/smoke-image-dependencies.mjs` comparte contratos
con test:quality. Genera archivos sintéticos en TEMP y ejecuta Node y el ejecutable
Electron con `ELECTRON_RUN_AS_NODE=1`: sin app/BrowserWindow, perfil real, captura,
control de escritorio ni visualización. HTTP(S)/fetch se bloquean por proceso.
No utiliza otra superficie para revisar el archivo local bloqueado de la unidad
anterior. Esa revisión visual y su fixture siguen pendientes por separado.

El primer intento falló por leer Sharp/package.json fuera de sus exports; se
corrigió el propio QA a Sharp.versions.sharp, sin modificar el producto ni
omitir la comprobación. La ejecución final y sus hashes se registran en
[evidencia nativa](native-summary.json). No acredita búsqueda visual, permisos del
SO, automatización real, UI, instalador, otros SO o CI remoto.

La ejecución final `native-final.log`, temporal `soflia-image-contract-native-ZTkcAr`,
aprobó diez comprobaciones por runtime (veinte en total). Electron 44.9.3 carga
Node 24.22.0; el Node del entorno local es 26.7.0. Los dos archivos CJS ejecutados
coinciden por hash con las fuentes actuales. Los PNG son artefactos sintéticos
para validación de datos, sin afirmar revisión visual de imágenes.

## Autorrevisión adversarial

Se revisa resolución desde cada padre, eliminación física frente a lock,
manifiesto/instalación divergentes, ganchos, variantes de buffer/archivo,
conversiones de canales, APIs posicionales y errores. Los contratos funcionales
ya pasaban antes: prueban conservación, mientras el caso rojo demuestra la
resolución incompatible retirada. No se presenta un override mayor de Zod,
una supresión del aviso file-type o un downgrade automático como remediación.

Revisión independiente pendiente; no se archiva. Para recuperar, mantener
manifiesto/lock coherentes y resolver la compatibilidad con los contratos antes
de reinstalar sin scripts; no restaurar vulnerables para forzar verde. Retirar
overrides al cerrar peers en el padre o migrar su consumidor con evidencia.

## Verificación final

`npm run verify:pr` completó sus trece etapas con código 0 en 364.18 s:

- Vitest: 5,866 aprobadas y cinco omitidas; 508 archivos aprobados y dos omitidos
  (510 total), duración 237.86 s. Es el mismo conjunto del producto de la unidad
  30; no se atribuyen a esta unidad casos Vitest nuevos.
- Tooling: 51 aprobadas, tres más que la unidad 30. Incluyen resolución física,
  rechazo de configuración divergente y consumidores de imágenes reales.
- Python 3.12.11: 33 aprobadas con `SOFLIA_TEST_PYTHON` apuntando al intérprete QA.
- Tipos, harness, supply-chain, runtime estable, especificaciones y documentación
  aprobados. Lint: 397 archivos sin deuda nueva; enlaces válidos en 763 Markdown.
  Inventario derivado de 689 archivos de prueba, distinto de suites ejecutadas.

`npm run app:smoke:build` aprobó con código 0 en 72.22 s en
`pulse-app-build-ymsec8`: seis outputs no vacíos y 3,484 fuentes copiadas con hash
coincidente. Enumera 3,485 rutas Git; la diferencia es la eliminación local
preexistente `electron/wa-agent/bulk-label-verification.ts`, preservada y omitida
al copiar. Sin `.env`, empaquetado, arranque completo ni publicación. Los avisos
de chunks/imports dinámicos del bundler permanecen visibles.

Las 3,504 fuentes del manifiesto ampliado permanecieron idénticas antes/después
de gate/build, con SHA256
`3da2cbdfe9bc84dd2ae2bdb27cac4fc3541bb1afc0051fa43f9ad2c6499a7324`.
Respecto a la unidad 30 sólo cambian manifiesto/lock y se agregan cuatro fuentes
QA. Los recibos distinguen rutas enumeradas de archivos existentes copiados.

[Gate](gate-summary.json), [build](build-summary.json),
[fuentes](source-evidence.json) y [logs](log-evidence.json) conservan la evidencia.
Los comandos completos están en `gate-final.log` y `build-final.log` del temporal
señalado. Los cambios posteriores sólo registran docs/tareas/recibos, con
comprobaciones documentales separadas y sin modificar fuentes de producto/QA.
CI remoto, otros sistemas, instalador y revisión independiente no se ejecutaron.
No se recalcula el índice global experto a partir de avisos, tests o paquetes.
