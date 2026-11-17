# Acotar trabajo de fondo y caché de memoria

## Why

Las capturas periódicas pueden solaparse durante OCR lento y publicar resultados de una sesión detenida. PathMemory admite varios timers y actualizaciones simultáneas, y consulta metadatos secuencialmente. La caché de embeddings conserva sesiones sin un presupuesto global.

## What Changes

- Un pipeline de captura periódica en vuelo, con revisiones de sesión/configuración y errores controlados.
- Inicio idempotente y actualizaciones seriales/coalescentes del índice de rutas; consultas de metadatos con concurrencia acotada.
- Caché LRU de vectores con presupuesto; recarga desde la misma base al expulsar entradas.

## Capabilities

### New Capabilities
- `bounded-background-work`: capturas e indexación sin duplicación, caché residente acotada.

### Modified Capabilities

Ningún canal, tabla o capacidad pública cambia.

## Impact

Servicios main de monitoreo, rutas y memoria. No se recorta historial persistido, no se desactivan OCR/capturas/búsquedas ni se reducen los límites de búsqueda existentes.
