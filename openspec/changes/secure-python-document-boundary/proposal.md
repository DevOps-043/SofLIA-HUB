## Why

La frontera Python permite consultas y lectura por ruta libre desde cualquier emisor IPC y declara guardada privacidad aunque falle el disco. Además, los lectores alternativos y etiquetas de hojas pueden eludir la redacción solicitada.

## What Changes

- Autorizar y validar los cinco canales existentes, con errores/DTO controlados y contexto cancelable de sesión/política.
- **BREAKING**: parseDocument renderer abre selector main, sin argumento de ruta; no hay consumidor renderer de producción de la firma anterior. Main conserva API por ruta para sus lectores ya autorizados.
- Crear snapshot temporal verificable de la selección, limitar archivo/entrada/salida y retirar procesos/peticiones obsoletas sin replay.
- Persistir configuración validada sin falso éxito y revisar nativamente la desactivación de protección. La preferencia sigue siendo de máquina.
- Redactar etiquetas de tablas y bloquear respaldo crudo/imagen de documentos Office cuando se exige protección, manteniendo degradación habitual al no exigirla.
- Sincronizar cuatro capas/UI, documentación y pruebas TS/Python/nativas aisladas, sin archivos personales ni cuentas.

## Capabilities

### New Capabilities

- `python-document-boundary`: lectura local autorizada y política de redacción verificable entre IPC, sidecar y lectores internos.

### Modified Capabilities

Ninguna especificación vigente cambia por nombre. Se documenta el nuevo límite integral de esta superficie existente.

## Impact

PythonToolsService/handlers, configuración y servicio de selección main, preload/shared/wrapper, ajustes de privacidad, dos lectores main y redacción Python. Sin dependencias, canales nuevos ni migraciones/despliegues. Conserva procesos separados y trabajo de diecisiete unidades previas. No certifica ausencia total de PII, parsers, imágenes ni recursos del SO.
