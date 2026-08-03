# Documentacion de Pulse Hub

Estado: vigente. Actualizado: 2026-07-21.

Este indice es la entrada por audiencia. No es necesario cargar todo el catalogo
para una tarea: cada agente debe abrir el documento del dominio afectado y sus
enlaces de evidencia.

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

## Empezar a trabajar

- [Guia rapida del Arnes en Antigravity](operations/harness-quickstart.md)
- [Estandar maestro de ingenieria](standards/engineering-practices.md)
- [Alias compatible `@prompt_maestro`](prompt_maestro.md)

## Producto y requisitos

- [Definicion, alcance y capacidades](product/product-definition.md)
- [Actores, roles y responsabilidades](product/stakeholders-and-actors.md)
- [Reglas de negocio](product/business-rules.md)
- [Requisitos funcionales](product/functional-requirements.md)
- [Requisitos no funcionales](product/non-functional-requirements.md)
- [Historias de usuario](product/user-stories.md)
- [Decisiones, limites y parametros](product/decisions-and-limits.md)
- [Matriz de trazabilidad](product/traceability-matrix.md)

## Arquitectura y datos

- [Stack tecnologico](architecture/technology-stack.md)
- [Frontend React](architecture/frontend.md)
- [Backend Electron](architecture/backend-electron.md)
- [IPC e integraciones](architecture/ipc-and-integrations.md)
- [Agentes y automatizacion](architecture/agents-and-automation.md)
- [Manual del agente runtime](architecture/runtime-agents-manual.md)
- [Referencia completa del agente (consolidada)](architecture/agent-complete-reference.md)
- [Parametros runtime](architecture/runtime-parameters.md)
- [Arquitectura de datos](data/data-architecture.md)
- [Diccionario de datos](data/data-dictionary.md)

## Experiencia, seguridad y operacion

- [Arquitectura de informacion](ux/information-architecture.md)
- [Sistema visual y paleta](ux/design-system.md)
- [Pantallas y flujos](ux/screen-catalog-and-flows.md)
- [Accesibilidad](ux/accessibility.md)
- [Seguridad y privacidad](security/security-and-privacy.md)
- [Configuracion y secretos](operations/configuration.md)
- [Desarrollo, CI y DevOps](operations/development-and-devops.md)
- [Release, respaldo y recuperacion](operations/release-and-recovery.md)
- [Estrategia e inventario de pruebas](quality/test-strategy-and-inventory.md)
- [Fuentes del Arnes y Antigravity](references/harness-sources.md)

## Historico

`archive/` conserva prompts, handoffs, reportes y guias sustituidas. Su
contenido no es normativo y no debe cargarse automaticamente en agentes.

## Regla de mantenimiento

Toda funcionalidad que cambie contratos, datos, IPC o comportamiento visible
debe actualizar el documento canonico correspondiente en el mismo cambio.
