## Why

El endpoint de descarga expone una URL firmada sin validar su destino ni el contenido, y la UI no permite guardar uploads. Una copia local debe vincularse a evidencia revisada y al contexto vigente, sin sobrescribir o dejar un archivo parcial como resultado.

## What Changes

- Obtener metadata/URL/bytes sólo en main y validar origen/path/token/TTL, destino, tipo, tamaño/hash y estado ready.
- Guardar una copia nueva mediante aprobación/selector nativos y publicación exclusiva de bytes completos.
- Cancelar por caller/sesión/proyecto o ID explícito; conservar resultado de publicación si el contexto cambia después del commit.
- Compartir formatos y registro de operaciones de archivo con la subida, manteniendo sus pruebas.
- **BREAKING**: sustituir getDownload renderer por downloadFile/cancelDownload y añadir Guardar copia en evidencia upload ready.

## Capabilities

### New Capabilities
- `project-hub-file-downloads`: descarga validada y copia nativa cancelable sin tokens/rutas renderer.

### Modified Capabilities
Ninguna. No cambian endpoints ni permisos remotos.

## Impact

Servicios main de archivos, handler/allowlist/preload, contrato/wrapper/hook/UI y pruebas/docs/smoke. Sin dependencias, SQL, ejecución de archivos ni despliegue. Descarga y subida comparten exclusión del registro y confirmación existente.
