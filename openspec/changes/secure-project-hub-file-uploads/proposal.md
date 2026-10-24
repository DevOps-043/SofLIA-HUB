## Why

El uploader renderer usa URLs/tokens recibidos sin comprobar destino ni lifecycle, recorta selecciones y no conserva progreso parcial. La aprobación IPC de intención/complete no protege el PUT que ocurre fuera de main.

## What Changes

- Seleccionar, inspeccionar, aprobar y subir archivos desde main con credenciales temporales privadas.
- Validar extensión/MIME/firma, tamaño/hash y estabilidad del archivo antes de red.
- Validar origen storage configurado, path por workspace/proyecto/evidence y token de la URL; bloquear redirecciones y reintentos de escritura.
- Añadir cancelación ligada a caller/sesión/proyecto y resultados con contadores confirmados/incertidumbre.
- **BREAKING**: retirar exposición renderer de createUploadIntent/completeUpload y sustituirla por uploadFiles/cancelUpload. Migrar su único consumidor y preservar endpoints/métodos internos v1.

## Capabilities

### New Capabilities
- `project-hub-file-uploads`: selección/confirmación/subida nativa acotada y cancelable con tokens privados.

### Modified Capabilities
Ninguna. La autorización/custodia existentes se reutilizan, sin alterar endpoints del servidor.

## Impact

Servicio/coordinador de archivos main, handler, allowlist/preload, contrato compartido, wrapper y UI de proyectos; pruebas/docs/smoke. Sin dependencias, SQL ni despliegue. Permanecen descargas firmadas, huérfanos pendientes y permisos/revocación/RLS del servidor.
