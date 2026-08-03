# Regla de workspace de Pulse Hub

Lee y aplica `AGENTS.md` y `docs/standards/engineering-practices.md` antes de
modificar el repositorio. La fuente canonica de contexto es `docs/`, la de
agentes y skills es `ai-specs/`, y el estado durable de cada cambio material
vive en `openspec/changes/`.

Reglas obligatorias:

- Mantener UI, prompts, logs, comentarios y documentacion en espanol.
- No inventar contratos, canales IPC, tablas, permisos ni resultados de pruebas.
- Respetar la frontera Electron main -> handler -> preload/allowlist -> wrapper
  tipado del renderer.
- Pedir aprobacion humana para acciones destructivas, envios o cambios externos.
- No cargar skills de desarrollo como herramientas runtime del producto.
- No leer ni modificar `.env`, secretos o configuracion local no versionada.
- Actualizar especificacion, documentacion y evidencia junto con el codigo.
- Ejecutar la compuerta proporcional indicada en `AGENTS.md` antes de cerrar.

Para procedimientos repetibles usa los workflows `openspec-*` de este workspace
y las skills descubiertas desde `.agents/skills/`. El alias compatible
`@docs/prompt_maestro.md` conduce al mismo estandar canonico.
