# Exposición segura a agentes runtime

Una skill de desarrollo no es una herramienta runtime. Para exponer una capacidad
al producto deben existir, como mínimo:

1. Identificador estable y propietario.
2. Esquema Zod cerrado para entrada y salida.
3. Clasificación de riesgo y regla HITL.
4. Adaptador de ejecución en Electron main.
5. Allowlist por agente y contexto, incluidos grupos de WhatsApp.
6. Sanitización, timeout, cancelación e idempotencia cuando aplique.
7. Auditoría con `trace_id`, actor y resultado sin secretos.
8. Pruebas positivas, negativas y de permisos.

El registro documental vive en `ai-specs/agents/registry.yaml`. El primer
registro ejecutable por dominio vive en `electron/mcp-manager/` para plugins
dinámicos y se documenta en
`docs/architecture/runtime-dynamic-tools.md`. Nunca debe cargar
`ai-specs/skills/` directamente ni convertir instrucciones Markdown en permisos.
