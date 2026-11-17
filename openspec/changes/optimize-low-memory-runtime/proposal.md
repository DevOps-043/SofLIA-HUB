# Reducir trabajo residente sin retirar capacidades

## Why

El usuario usa 4 GB/Pentium como analogía de recursos muy limitados, no como requisito de certificar un modelo físico concreto. El renderer flotante monta managers del shell principal, el refresco remoto sigue activo oculto y puede solaparse, y vistas secundarias se importan al inicio. Son costes evitables sin eliminar herramientas. Las mejoras deben medirse sin prometer consumo máximo universal de videollamadas o modelos locales.

## What Changes

- Entrada independiente del avatar flotante con autenticación y tema, sin managers de chat/carpetas/IRIS.
- Refrescos remotos por visibilidad, con coalescencia de eventos, exclusión de solapamiento y limpieza de callbacks.
- Carga diferida de superficies secundarias y reutilización de Markdown estable.

## Capabilities

### New Capabilities
- `low-memory-runtime`: reducir trabajo duplicado, invisible o repetido del renderer.

### Modified Capabilities

Ninguna API pública cambia.

## Impact

Entrada React, hooks de sincronización, vistas y Markdown. Sin cambios IPC, tablas, credenciales ni funciones disponibles. El servidor y los agentes siguen funcionando en segundo plano.
