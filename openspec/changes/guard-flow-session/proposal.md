## Why

Flow puede reintentar una solicitud con texto o captura de una sesión anterior
si cambia la cuenta mientras espera al proveedor.

## What Changes

- Vincular el análisis, reintentos y fallback a la sesión original.
- Rechazar resultados de análisis y transcripción posteriores a la revocación.
- Mantener reintentos y fallback cuando la sesión sigue vigente.

## Capabilities
### New Capabilities
- `flow-session`: vigencia del análisis y transcripción durante cada operación.
### Modified Capabilities
Ninguna.

## Impact
Renderer y pruebas. No mueve Gemini a main ni revierte llamadas ya enviadas.
