# Fuentes y adaptacion del Arnes

Estado: vigente. Actualizado: 2026-10-15.

<!-- evidence: ai-specs/README.md -->
<!-- evidence: openspec/changes/adapt-harness-and-document-system/context-pack.md -->
<!-- evidence: scripts/ai/sync-agent-adapters.mjs -->
<!-- evidence: openspec/changes/implement-soflia-harness/design.md -->

## Identificación del repositorio de origen

El repositorio que se tomó como referencia fue
**[LIDR-academy/lidr-specboot](https://github.com/LIDR-academy/lidr-specboot)**.
La atribución está registrada desde el cambio de adaptación del 2026-07-21,
commit local `2a97251`, y en su
[diseño](../../openspec/changes/adapt-harness-and-document-system/design.md).
El arnés fundacional de SofLIA se introdujo en `dcf3125`, también el 2026-07-21.

El 2026-10-15 se volvió a consultar el repositorio público: su README describe
un contexto de desarrollo portable con `docs/`, `ai-specs/`, adaptadores para
varios copilotos y uso conjunto con OpenSpec. Esto confirma la referencia
externa; la versión actual de su rama principal no representa necesariamente
el contenido adoptado en julio.

La [arquitectura actual](../architecture/development-harness.md) explica la
adaptación implementada y la [guía de portabilidad](../operations/port-harness-to-another-system.md)
detalla cómo llevarla a otro sistema.

## PDF entregado

Fuente: `Resumen - Arnes.pdf`, cuatro paginas, entregado por el usuario el
2026-07-21 y revisado visualmente completo. El binario no se copia al repositorio;
esta pagina conserva solo la sintesis necesaria.

Esa descripción proviene del registro histórico de julio. En la revisión del
2026-10-15 no se volvió a examinar el PDF: su autor, URL pública y relación
editorial con Specboot no están acreditados por los archivos consultados.

Principios extraidos:

1. Instrucciones: guias vivas que el agente puede cargar por contexto.
2. Herramientas: shell, archivos, MCP y Git con fronteras claras.
3. Entorno local: runtime, dependencias, base local y scripts reproducibles.
4. Estado: tareas/commits durables, no solo conversacion.
5. Feedback: lint, unit, E2E y auditoria para corregir el loop.
6. Enriquecer historias antes de programar: casos borde, permisos y reglas.
7. Spec-driven: propuesta, requisitos, diseno y tareas atomicas.
8. Aislar ejecucion y auditar con una perspectiva adversarial antes de PR.

Adaptacion SofLIA: `AGENTS.md`/docs/skills, tooling del repo, npm+Electron+Python,
OpenSpec+Git y compuertas de PR/release.

## LIDR Specboot

Repositorio revisado: [LIDR Academy / lidr-specboot](https://github.com/LIDR-academy/lidr-specboot),
commit `d19d286e9895bdf9be54b3e97070b9fe081c93af` observado el 2026-07-21.

El hash se conserva como evidencia histórica local. La consulta web del
2026-10-15 confirmó el repositorio y su README, pero no pudo recuperar el árbol
de ese commit; no se afirma una nueva comparación archivo por archivo con él.

Elementos adoptados:

- `ai-specs/skills` como procedimientos reutilizables;
- roles separados de backend/frontend/producto adaptados a dominios SofLIA;
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
versionados determinan lo que SofLIA implementa.

## Alcance de la atribución

- **Confirmado por el registro local:** referencia Specboot, PDF, decisiones de
  adaptación y commits fundacionales de SofLIA.
- **Confirmado en el árbol actual:** sincronizador, validadores, compuertas,
  configuración OpenSpec y adaptadores específicos del equipo.
- **No demostrado:** que todo el código del arnés proceda de Specboot o que el
  PDF haya sido publicado por LIDR. La evidencia identifica influencias y
  decisiones, no una equivalencia literal entre repositorios.
- **Evolución independiente:** el arnés runtime se incorporó después. La
  [investigación de Codex](../reports/codex-repository-research-2026-09-21.md)
  documenta otra fuente técnica; su integración real se describe en el
  [contrato runtime](../architecture/runtime-multiagent-harness.md).
