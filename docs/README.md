# Documentacion de Soflia Hub

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

- [Arquitectura del arnés de desarrollo](architecture/development-harness.md)
- [Implementar el arnés en otro sistema](operations/port-harness-to-another-system.md)
- [Guia rapida del Arnes en Antigravity](operations/harness-quickstart.md)
- [Estandar maestro de ingenieria](standards/engineering-practices.md)
- [Alias compatible `@prompt_maestro`](prompt_maestro.md)

## Producto y requisitos

- [Identidad de Soflia Hub](product/brand-identity.md)
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
- [Presentaciones y producción audiovisual](architecture/presentation-audiovisual-production.md)
- [Diseño de documentos generados](architecture/generated-documents.md)
- [Plataforma del navegador integrado](architecture/integrated-browser-platform.md)
- [IPC e integraciones](architecture/ipc-and-integrations.md)
- [Aula de sesiones de Learning](architecture/learning-live-workspace.md)
- [Operación del estudio síncrono](operations/live-studio-runtime.md)
- [Grabación y repeticiones de webinars](operations/webinar-recordings.md)
- [Plan de grabación de webinars y repeticiones en Learning (propuesta)](../openspec/changes/record-webinars-and-publish-replays/design.md)
- [Movimiento autónomo del orbe y prácticas guiadas](architecture/autonomous-orb-guidance.md)
- [Project Hub unificado](architecture/project-hub-unified.md)
- [Agentes y automatizacion](architecture/agents-and-automation.md)
- [Manual del agente runtime](architecture/runtime-agents-manual.md)
- [Arnés multiagente: reuniones, chat, WhatsApp y Computer Use](architecture/runtime-multiagent-harness.md)
- [Inicio de sesión federado con SofLIA Learning (SSO) y guía de portabilidad a Project Hub](architecture/learning-sso-federated-login.md)
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
- [Conversaciones no disponibles después del login](operations/troubleshooting/password-change-login.md)
- [Estrategia e inventario de pruebas](quality/test-strategy-and-inventory.md)
- [Fuentes del Arnes y Antigravity](references/harness-sources.md)
- [Investigación del repositorio Codex para SofLIA Hub](reports/codex-repository-research-2026-09-21.md)
- [Codex: mejoras con valor directo para usuarios de SofLIA](reports/codex-user-value-research-2026-09-25.md)
- [Plan propuesto de presentaciones y producción audiovisual](plans/presentaciones-y-skill-audiovisual-2026-10-11.md)

## Historico

`archive/` conserva prompts, handoffs, reportes y guias sustituidas. Su
contenido no es normativo y no debe cargarse automaticamente en agentes.

## Regla de mantenimiento

Toda funcionalidad que cambie contratos, datos, IPC o comportamiento visible
debe actualizar el documento canonico correspondiente en el mismo cambio.
