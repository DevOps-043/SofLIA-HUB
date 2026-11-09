## Why

El chat, los especialistas, las acciones de investigación y las utilidades de texto todavía construyen
clientes Gemini con credenciales en el renderer Electron.

## What Changes

Resolver Gemini en main y mantener el historial del turno bajo su autoridad.
Conservar el dispatcher de herramientas, los mensajes multimodales, el formato
de respuestas y la compatibilidad del navegador independiente.

## Capabilities

### New Capabilities
- `native-gemini-conversation`: inferencia y continuidad de turno Gemini en main.

### Modified Capabilities
Ninguna.

## Impact

Main, preload, wrapper, consumidores de chat, títulos, redacción y optimización de prompts. El puente no ejecuta herramientas.
