## Why

El lint incremental selecciona commits contra la rama base, pero usa HEAD como
baseline: en CI el código introducido se compara consigo mismo. Además sólo
selecciona ts/tsx y omite los scripts JS. Ambas rutas devolvieron éxito en un
repositorio de QA con incidencias nuevas.

## What Changes

- Verificar referencia configurada y ancestro común; comparar commits con esa
base y cambios locales con HEAD, sin enmascarar errores Git.
- Seleccionar ts/tsx/mts/cts/js/jsx/mjs/cjs con rutas NUL y analizar fuentes
reales fuera de exclusiones, sin tratar nombres de archivo como globs.
- Definir contextos Node/CommonJS/browser explícitos manteniendo reglas.
- Conservar rechazo de parser fatal y presupuestos históricos por regla/severidad;
añadir pruebas CLI reales y corregir incidencias nuevas de scripts propios.

## Capabilities

### New Capabilities

- `incremental-lint-boundary`: selección y baseline verificables, cobertura TS/JS
y fallo observable ante regresión o comparación no demostrable.

### Modified Capabilities

Ninguna capacidad runtime. No se cambian APIs de producto o datos.

## Impact

scripts/quality/lint-*, ESLint, pruebas Node del tooling y documentación del gate.
Se mantiene el mismo verify:pr y HARNESS_BASE_REF. No hay dependencias nuevas,
acciones remotas, cambios SQL o secretos. El contenido de índice pendiente no
se certifica como artefacto independiente del worktree que se verifica.
