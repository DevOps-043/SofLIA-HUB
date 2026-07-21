# Documentacion de SofLIA Hub

Este indice separa documentacion vigente de material historico.

## Fuente de verdad

- `standards/`: reglas obligatorias de implementacion y verificacion.
- `architecture/`: arquitectura vigente y limites entre modulos.
- `product/`: PRD, alcance y comportamiento de producto.
- `contracts/`: contratos API y artefactos consumibles por herramientas.
- `operations/`: instalacion, release, migraciones y troubleshooting.
- `decisions/`: decisiones de arquitectura (ADR).
- `plans/`: trabajo aprobado y adopciones progresivas, incluido el [Arnes](plans/harness-rollout.md).
- `reports/`: evidencia y auditorias actuales.

## Historico

`archive/` conserva prompts, handoffs, reportes y guias sustituidas. Su
contenido no es normativo y no debe cargarse automaticamente en agentes.

## Regla de mantenimiento

Toda funcionalidad que cambie contratos, datos, IPC o comportamiento visible
debe actualizar el documento canonico correspondiente en el mismo cambio.
