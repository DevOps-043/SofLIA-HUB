## Why

Peers abiertos de plugin-scale y plugin-shadow 0.22.12 instalan plugins Jimp 1
con otras APIs y un subárbol Zod 3 vulnerable, aunque nut-js/shared usan Jimp 0.22.
La auditoría actual registra doce paquetes afectados, seis high y seis moderate.

## What Changes

- Restringir sólo esos peers a las versiones compatibles del mismo conjunto 0.22.
- Verificar árbol físico, contratos reales de imágenes de Jimp/nut-js/shared y
  rechazo de entradas inválidas con fixtures propios, sin escritorio real.
- Conservar evidencia comparable de lock, auditoría, ganchos, gate y build.

El aviso heredado file-type no se oculta. No se cambia API, permisos ni IPC, ni
se declara que la importación actual de Jimp falle o que todo el producto quede
sin vulnerabilidades.

## Capabilities

### New Capabilities

Ninguna: resolución de dependencias y QA sin nuevo comportamiento público.

### Modified Capabilities

Ninguna. `skip_specs: true` documenta el cambio sin delta del producto.

## Impact

Manifiesto/lock raíz, contratos de tooling y documentación de dependencias.
Sin dependencias directas nuevas ni cambios de implementación main/preload/renderer.
Se mantiene instalada la integración nativa y se ejecuta instalación sin scripts.
