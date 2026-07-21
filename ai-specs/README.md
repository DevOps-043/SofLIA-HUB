# Arnés de agentes de SofLIA

Este directorio es la fuente canónica para el trabajo asistido por agentes. Las
carpetas específicas de cada herramienta solo adaptan estas instrucciones.

## Flujo obligatorio

1. Enriquecer la solicitud y fijar alcance, riesgos y criterios verificables.
2. Crear o actualizar el cambio activo en `openspec/changes/`.
3. Aislar cambios materiales en una rama o worktree recuperable.
4. Implementar por tareas pequeñas, manteniendo especificación y código alineados.
5. Ejecutar evidencia proporcional al riesgo.
6. Hacer una revisión adversarial antes de declarar el cambio listo.

La operacion paso a paso se documenta en
[`docs/operations/harness-quickstart.md`](../docs/operations/harness-quickstart.md).
Las buenas practicas extensas viven solo en
[`docs/standards/engineering-practices.md`](../docs/standards/engineering-practices.md);
`docs/prompt_maestro.md` mantiene el alias historico para Antigravity.

## Áreas

- `policies/`: límites de herramientas, permisos y separación de contextos.
- `agents/development/`: roles que modifican y revisan el repositorio.
- `agents/runtime/`: roles embebidos en el producto, con capacidades permitidas.
- `skills/`: procedimientos reutilizables y verificables.
- `templates/`: formatos mínimos para contexto y evidencia.

Consulta `agents/registry.yaml` antes de conectar una capacidad a un agente runtime.

## Superficies compatibles

- Codex: adaptadores en `.codex/skills/` y router `codex.md`.
- Claude: adaptadores en `.claude/skills/` y router `CLAUDE.md`.
- Antigravity: adaptadores en `.agents/skills/`, regla de workspace en
  `.agents/rules/` y workflows en `.agents/workflows/`.

Cursor y Gemini CLI no forman parte del entorno de desarrollo de SofLIA Hub. No
se deben regenerar `.cursor/`, `.gemini/` ni `GEMINI.md`. Las referencias a
Gemini dentro de `src/` o `electron/` corresponden al proveedor de IA del
producto, no a una superficie del arnes.
