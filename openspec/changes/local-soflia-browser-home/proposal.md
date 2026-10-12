# Inicio local de SofLIA

## Why

Las pestañas nuevas cargan Google antes de ofrecer contenido. La espera de red
deja una superficie vacía y retrasa el inicio del trabajo.

## What Changes

- Servir una portada local de SofLIA dentro de la vista Chromium existente.
- Reutilizar logo y tokens del tema, con buscador, teclado y movimiento reducido.
- Restringir el nuevo esquema a una única URL estática, sin Node, preload ni red
  de recursos; conservar las validaciones al salir hacia una búsqueda o sitio.
- Recuperar, recargar y reabrir la portada como cualquier pestaña.

## Impact

Inicio del navegador, validación/restauración de URL y presentación de la barra.
Sin dependencias ni canales IPC nuevos. Continúa en `codex/browser-fluidity`
preservando el trabajo local existente. Las páginas externas conservan Chromium.
