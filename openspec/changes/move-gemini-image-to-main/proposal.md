## Why

La generación de imágenes utiliza el SDK y credenciales Gemini desde renderer.
Esto amplía la exposición de la clave y deja el transporte sin la misma barrera
nativa de emisor y sesión aplicada a otras inferencias.

## What Changes

- Resolver credenciales Lia/entorno y generar imágenes en main para Electron.
- Mantener un contrato limitado, sin pasar claves, URLs ni modelos por IPC.
- Validar emisor, sesión, tamaño, plazo y concurrencia; revocar respuestas viejas.
- Conservar prompts y resultado existentes y el funcionamiento web autónomo.

## Capabilities
### New Capabilities
- `native-gemini-image`: generación de imagen mediante main con sesión vigente.
### Modified Capabilities
Ninguna.

## Impact
Main, preload, renderer, pruebas y documentación. Otros usos de Gemini continúan
en renderer; no modifica RLS, servidor ni custodia del resto de las claves.
