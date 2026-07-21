# Proponer un cambio OpenSpec

Convierte una solicitud material en un cambio verificable antes de implementar.

1. Lee `AGENTS.md`, `docs/README.md` y las normas del area afectada.
2. Ejecuta la skill `enrich-requirement` y completa un Context Pack basado en
   `ai-specs/templates/context-pack.md`.
3. Inspecciona codigo, contratos, datos, permisos y pruebas existentes; no
   completes huecos con suposiciones silenciosas.
4. Crea `openspec/changes/<nombre>/proposal.md`, `design.md`, `tasks.md` y los
   deltas bajo `specs/<capacidad>/spec.md`.
5. Incluye escenarios de error, autorizacion, HITL, rollback y verificacion.
6. Ejecuta `npx openspec validate <nombre> --strict --no-interactive`.
7. Entrega el alcance, no objetivos, riesgos e incertidumbres pendientes.
