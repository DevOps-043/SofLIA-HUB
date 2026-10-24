## Why

Los servicios Python de voz y documentos comparten un defecto de propiedad: eventos de un hijo antiguo pueden retirar el hijo actual y sus peticiones. La detección de arranque tampoco obliga a todos los consumidores a esperar ready, y el framing carece de límites explícitos.

## What Changes

- Extraer una conexión NDJSON por hijo, compartida por ambas fachadas; respuestas, eventos y fallos pertenecen a esa generación.
- Esperar ready con versión v4/v1 comprobada, startup single-flight y limpieza de timers/listeners/peticiones en fallos/cierre.
- Invalidar stop antes de esperas; cancelar restart de voz y evitar reemplazos durante cierre pendiente.
- Acotar línea, payload, cola stdin y peticiones; fallar de forma controlada ante protocolo inválido, sin registrar contenido crudo.
- Conservar métodos, resultados de dominio, canales IPC, configuración y consumidores. Añadir pruebas de carreras, procesos reales ficticios, documentación y evidencia.

## Capabilities

### New Capabilities
- `python-sidecar-lifecycle`: transporte y propiedad por proceso para los dos sidecars existentes.

### Modified Capabilities
Ninguna. No se modifican los protocolos Python ni la autorización IPC.

## Impact

electron/python-runtime-service.ts, electron/python-tools-service.ts y nuevo módulo de transporte main; pruebas de voz/Meeting Live/documentos, smoke sin captura, docs y OpenSpec. Sin dependencias, migraciones, despliegues, cambios de secretos ni descargas de modelos.
