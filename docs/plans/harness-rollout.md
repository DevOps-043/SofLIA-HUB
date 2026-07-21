# Adopción progresiva del Arnés

La base estructural se implementó en `codex/harness-foundation`. La adopción debe
continuar por dominios para no mezclar reorganización, refactor masivo y permisos
runtime en un solo despliegue.

## Etapa 1 — Fundación implementada

- Contexto canónico en `AGENTS.md`, `docs/`, `ai-specs/` y `openspec/`.
- Ocho skills propias y adaptadores para Codex, Claude, Cursor y Gemini.
- OpenSpec inicializado y primer cambio piloto validado.
- Compuertas de estructura, enlaces, tipos, lint incremental, pruebas y build.
- Taxonomía única para SQL, recursos, documentación y archivo histórico.

## Etapa 2 — Piloto funcional

Aplicar el flujo completo a una capacidad acotada de Meeting Ops:

1. Enriquecer un requerimiento real con `$enrich-requirement`.
2. Crear propuesta, requisitos, diseño y tareas OpenSpec.
3. Implementar un cambio vertical con pruebas y evidencia.
4. Medir retrabajo, errores de contexto, tiempo de revisión y defectos escapados.
5. Ajustar skills solo con evidencia del piloto.

Criterio de salida: un cambio de producto archivado en OpenSpec, compuerta de PR
verde y revisión humana que confirme trazabilidad útil.

## Etapa 3 — Gobernanza runtime ejecutable

Crear un cambio OpenSpec independiente para un registro tipado en Electron main.
Cada capacidad deberá declarar esquema cerrado, propietario, agente permitido, riesgo,
HITL, contexto de grupo, timeout, idempotencia y auditoría. Migrar primero una tool
de solo lectura; después una escritura reversible con aprobación. No cargar las
skills Markdown de desarrollo dentro del registro.

Criterio de salida: llamadas sin metadatos o fuera de allowlist rechazadas por pruebas
automáticas, y ninguna regresión en las restricciones de grupos de WhatsApp.

## Etapa 4 — Endurecimiento por módulo

- Reducir el baseline de lint por dominio y convertir gradualmente `lint:changed` en lint completo.
- Definir cobertura mínima para módulos estabilizados.
- Resolver vulnerabilidades restantes por paquete y superficie de explotación, sin actualizaciones forzadas.
- Dividir bundles grandes y eliminar importaciones estáticas/dinámicas mezcladas.
- Archivar planes y reportes cuando sus decisiones se consoliden como arquitectura.

Cada etapa debe tener su propio cambio OpenSpec, diff acotado y rollback independiente.
