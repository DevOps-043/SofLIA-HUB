# Estandar de documentacion

- Mantener una sola fuente canonica por tema.
- Mantener las 17 areas de buenas practicas en
  `docs/standards/engineering-practices.md`; `docs/prompt_maestro.md` es solo el
  alias compatible y no debe duplicar el contenido.
- No copiar snapshots de codigo dentro de `docs/`; enlazar archivo y commit.
- Marcar planes y reportes como historicos al completarlos.
- Actualizar cifras derivables mediante scripts, no manualmente.
- Usar nombres `kebab-case` sin espacios para rutas nuevas.
- Mover prompts y handoffs reemplazados a `docs/archive/`.
- Verificar enlaces locales mediante `npm run docs:check`.
- Declarar estado y rutas de evidencia en cada documento del catalogo de sistema.
- Usar IDs `BR-*`, `RF-*`, `RNF-*`, `HU-*`, `DEC-*` y `LIM-*` para requisitos
  trazables; no reutilizar un ID con otro significado.
- Ejecutar `npm run docs:system:check` para cobertura, evidencia, IDs, cifras
  derivables y paleta.
- Ejecutar `npm run harness:validate` para comprobar que `AGENTS.md`, Antigravity
  y el alias siguen cargando el estandar maestro.
- Distinguir decisiones confirmadas, inferencias y motivos no documentados.
