## Why

El usuario retira el proveedor Gemini de SofLIA Hub y sus herramientas. El sistema
adopta OpenAI para inferencia y mantiene los contratos de dominio verificables.

## What Changes

Retirar selección, claves públicas, SDK, endpoints y servicios de Gemini.
Migrar preferencias anteriores y productores de inferencia a OpenAI. Actualizar
agentes, herramientas, dependencias, CI y documentación canónica.

## Capabilities

### New Capabilities
- `openai-only-product`: proveedor de IA único con migración del producto existente.

### Modified Capabilities
Ninguna.

## Impact

Renderer, main, preload, sidecars, agentes, memoria, reuniones, WhatsApp, Flow,
imágenes, Computer Use, herramientas, configuración, pruebas y empaquetado.
