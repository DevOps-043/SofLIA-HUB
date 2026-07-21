## Why

Las herramientas cargadas desde `tools/dynamic/` se registran y ejecutan hoy con
un esquema mínimo, sin contrato de salida, política de agente, timeout ni
comprobación central de HITL. Esto deja una ruta runtime menos gobernada que las
herramientas estáticas de WhatsApp y contradice la denegación por defecto
definida por el nuevo arnés.

## What Changes

- **BREAKING**: exigir a toda herramienta dinámica ejecutable un contrato runtime
  con propietario, riesgo, agentes permitidos, regla HITL, disponibilidad en
  grupos, timeout y auditoría.
- **BREAKING**: exigir esquemas JSON cerrados de entrada y salida y validarlos con
  Zod antes y después del handler.
- Denegar el registro o la ejecución cuando falte metadata, el agente no esté
  autorizado, la aprobación requerida no exista o el contrato sea inválido.
- Reutilizar la confirmación humana de WhatsApp para herramientas dinámicas de
  escritura y volver a verificarla en el ejecutor central.
- Añadir timeout con señal de cancelación, `traceId` y eventos de auditoría sin
  argumentos ni secretos.
- Migrar el toolset incluido de Home Assistant al contrato gobernado y mostrar
  sus políticas en inventario/diagnóstico.

No objetivos: migrar en esta fase las más de 40 herramientas estáticas de
WhatsApp, crear un canal IPC nuevo, conceder capacidades a agentes de desarrollo
ni persistir argumentos sensibles de ejecución.

## Capabilities

### New Capabilities

- `runtime-tool-policy-enforcement`: Registro y ejecución segura de herramientas
  dinámicas mediante contratos tipados, validación cerrada, permisos, HITL,
  timeout y auditoría trazable.

### Modified Capabilities

Ninguna. La capacidad de gobernanza definida en el cambio fundacional aún no se
ha archivado como especificación base; este cambio entrega su primer mecanismo
ejecutable sin alterar un spec base publicado.

## Impact

Afecta `electron/mcp-manager*`, `electron/dynamic-tool*` y el dispatcher de
WhatsApp. Cambia el formato aceptado para archivos `.js`/`.ts` dinámicos y los
archivos generados del toolset Home Assistant. No agrega IPC, tablas, variables
de entorno ni dependencias; usa Zod ya instalado. Las herramientas dinámicas
legacy sin contrato dejan de cargarse hasta ser migradas y aparecerán como
faltantes/degradadas en el diagnóstico de toolsets administrados.
