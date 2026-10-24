## Why

El manifiesto PDF fija una dependencia transitiva con avisos de ejecución de código publicados. Además, fijar sólo lectores directos permite resolver transitivas variables y las pruebas QA anteriores no usaban todos los pins distribuidos.

## What Changes

- Actualizar lectores y closure a versiones verificadas mediante avisos/metadata primaria, preservando sus APIs.
- Incorporar lock de wheels con versiones/hashes y validación en staging; incluirlo en el fingerprint de preparación y smoke.
- Rechazar lectura PDF con pdfminer.six vulnerable o versión inverificable antes de interpretar el documento.
- Probar en venv temporal los pins exactos, hashes, conflictos y formatos, dejando explícitos límites de plataforma y alcance de auditoría.

## Capabilities

### New Capabilities

- `verified-python-reader-dependencies`: instalación reproducible del lector y rechazo de dependencias PDF conocidas como inseguras.

### Modified Capabilities

Ninguna especificación vigente cambia por nombre.

## Impact

Manifiestos del sidecar tools, preparación/fingerprint del runtime, política Python de PDF, catálogo de error main, pruebas y documentación. Sin canales, permisos, modelos ni SQL nuevos. No toca perfiles ni runtime local; conserva las diecinueve unidades anteriores.
