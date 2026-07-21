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

## Áreas

- `policies/`: límites de herramientas, permisos y separación de contextos.
- `agents/development/`: roles que modifican y revisan el repositorio.
- `agents/runtime/`: roles embebidos en el producto, con capacidades permitidas.
- `skills/`: procedimientos reutilizables y verificables.
- `templates/`: formatos mínimos para contexto y evidencia.

Consulta `agents/registry.yaml` antes de conectar una capacidad a un agente runtime.
