## Why

El repositorio mezclaba fuentes, copias, artefactos generados e instrucciones de
agentes divergentes, lo que hacía difícil delegar cambios con contexto estable y
comprobar que una implementación estuviera realmente terminada. Se necesita un
arnés común que convierta solicitudes en especificaciones, tareas y evidencia sin
ampliar los permisos de los agentes runtime.

## What Changes

- Reordenar documentación, SQL, recursos runtime y scripts en ubicaciones canónicas.
- Sustituir guías extensas por un router `AGENTS.md` y adaptadores delgados.
- Crear `ai-specs/` con políticas, roles, skills y plantillas reutilizables.
- Incorporar OpenSpec como ciclo especificación → tareas → aplicación → archivo.
- Agregar validadores de estructura, documentación, lint incremental y compuertas de PR/release.
- Registrar la arquitectura segura para futuras capacidades de agentes runtime.
- Retirar snapshots de código, configuraciones locales y artefactos generados versionados.

No objetivos: reescribir todos los módulos existentes, corregir toda la deuda de lint
histórica ni exponer las skills de desarrollo directamente dentro del producto.

## Capabilities

### New Capabilities

- `development-harness`: Contexto canónico, ciclo spec-driven, skills, aislamiento, compuertas y evidencia para cambios asistidos por agentes.
- `runtime-capability-governance`: Separación y requisitos de seguridad para registrar capacidades de agentes runtime.

### Modified Capabilities

Ninguna.

## Impact

Afecta la estructura del repositorio, guías de agentes, documentación, scripts npm,
CI, configuración de compilación, carga del Context Pack de reuniones y dependencias
de desarrollo. No modifica tablas remotas ni concede permisos runtime nuevos.
