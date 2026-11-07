## Why

Flow y dictado realizan llamadas Gemini en renderer, exponiendo credenciales a
ese proceso y duplicando transporte y gestión de sesión.

## What Changes

- Ejecutar análisis, fallback y transcripción en main para Electron.
- Usar contratos cerrados, límites de entrada y salida, sesión y concurrencia.
- Conservar los prompts, recuperación y navegador autónomo.

## Capabilities
### New Capabilities
- `native-flow-inference`: inferencia Flow nativa por operación permitida.
### Modified Capabilities
Ninguna.

## Impact
Main, preload, renderer, pruebas y documentación; otros usos Gemini siguen en
renderer. No cambia RLS ni revierte trabajos ya enviados.
