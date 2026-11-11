# Contexto del cambio

- Objetivo: retirar el subárbol Jimp 1 instalado por peers abiertos de plugins 0.22, conservando las APIs del consumidor y reduciendo avisos reales.
- Usuario o actor: automatización de escritorio que consume imágenes mediante nut-js/shared 4.2.6.
- Alcance: resolución de peers de plugin-scale y plugin-shadow 0.22.12, manifiesto/lock coherentes, instalación física y contratos de imágenes en tooling.
- No objetivos: migrar nut-js/Jimp a otra API, sustituir automatización, certificar parsers o todos los avisos, capturar/controlar escritorio, revisar visualmente la confirmación pendiente.
- Restricciones: preservar rama acumulativa y 439 entradas dirty, sin trasladar trabajo a otros worktrees, sin stage/commit/push/despliegue/secretos/.env. Sin ejecutar ganchos de instalación. La política que rechazó abrir un archivo local en navegador se conserva; las pruebas de buffers sintéticos no intentan visualizar ese archivo.
- Contratos afectados: árbol de dependencias y QA; las APIs main/preload/renderer, permisos y datos persistentes conservan comportamiento. Cambio de implementación sin delta de especificación del producto.
- Riesgo y HITL: ninguna cuenta o acción de escritorio real; pruebas aisladas de buffers y archivos ficticios. Mayor Jimp o file-type incompatible no se fuerza para obtener audit verde.
- Criterios verificables: peers de plugins 0.22 resuelven plugins compatibles; Jimp conserva lectura/escritura y conversiones RGB/BGR; nut-js conserva lector/escritor/color; rechazos de datos/ubicaciones inválidos; lock/paquetes físicos coinciden, sin ganchos nuevos ni nodos vulnerables nuevos; auditorías antes/después comparables; gate/build con fuentes congeladas.
- Incertidumbres: aviso file-type 16 heredado sigue abierto, sin backport compatible verificado. No se ha reproducido caída del Hub por peers 1: el constructor Jimp actual funciona. Node local 26 y Electron Windows no acreditan CI Node 24, instalador u otras plataformas; revisión independiente pendiente.
