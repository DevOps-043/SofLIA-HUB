# Fuentes y adaptacion del Arnes

Estado: vigente. Actualizado: 2026-07-21.

<!-- evidence: ai-specs/README.md -->
<!-- evidence: openspec/changes/adapt-harness-and-document-system/context-pack.md -->
<!-- evidence: scripts/ai/sync-agent-adapters.mjs -->

## PDF entregado

Fuente: `Resumen - Arnes.pdf`, cuatro paginas, entregado por el usuario el
2026-07-21 y revisado visualmente completo. El binario no se copia al repositorio;
esta pagina conserva solo la sintesis necesaria.

Principios extraidos:

1. Instrucciones: guias vivas que el agente puede cargar por contexto.
2. Herramientas: shell, archivos, MCP y Git con fronteras claras.
3. Entorno local: runtime, dependencias, base local y scripts reproducibles.
4. Estado: tareas/commits durables, no solo conversacion.
5. Feedback: lint, unit, E2E y auditoria para corregir el loop.
6. Enriquecer historias antes de programar: casos borde, permisos y reglas.
7. Spec-driven: propuesta, requisitos, diseno y tareas atomicas.
8. Aislar ejecucion y auditar con una perspectiva adversarial antes de PR.

Adaptacion Pulse: `AGENTS.md`/docs/skills, tooling del repo, npm+Electron+Python,
OpenSpec+Git y compuertas de PR/release.

## LIDR Specboot

Repositorio revisado: [LIDR Academy / lidr-specboot](https://github.com/LIDR-academy/lidr-specboot),
commit `d19d286e9895bdf9be54b3e97070b9fe081c93af` observado el 2026-07-21.

Elementos adoptados:

- `ai-specs/skills` como procedimientos reutilizables;
- roles separados de backend/frontend/producto adaptados a dominios Pulse;
- enriquecimiento, OpenSpec, tareas atomicas, worktrees y auditoria;
- una fuente canonica con adaptadores por herramienta;
- documentacion como fuente de verdad que debe personalizarse al proyecto real.

Elementos no copiados literalmente: agentes genericos, estructura Cursor/Gemini,
stack web supuesto y cualquier prompt que no respete Electron/IPC/Supabase/HITL.

## Antigravity

Fuentes oficiales revisadas el 2026-07-21:

- [Rules y Workflows](https://antigravity.google/docs/rules-workflows): reglas de
  workspace en `.agents/rules`, workflows Markdown invocables por `/nombre` y
  limite de 12,000 caracteres.
- [Codelab de Agent Skills](https://codelabs.developers.google.com/antigravity/how-to-create-agent-skills-for-antigravity-cli):
  skills locales en `.agents/skills/<name>/SKILL.md` con frontmatter name/description.

Implementacion resultante:

```text
ai-specs/skills/       fuente canonica
|- .codex/skills/      wrappers generados
|- .claude/skills/     wrappers generados
`- .agents/skills/     wrappers Antigravity generados

.agents/rules/         router/reglas workspace
.agents/workflows/     OpenSpec propose/apply/verify/archive
```

`.cursor/`, `.gemini/` y `GEMINI.md` se retiraron porque no son herramientas del
equipo. El proveedor Gemini del producto permanece documentado en stack/runtime.

## Regla de procedencia

Una idea externa se adapta solo cuando coincide con contratos y riesgos reales del
repo. La fuente externa orienta el proceso; el codigo, SQL y configuracion
versionados determinan lo que Pulse implementa.
