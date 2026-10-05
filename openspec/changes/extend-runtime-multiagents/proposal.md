## Why

El equipo de Meeting Ops no participa en las demás superficies. El usuario requiere coordinación multiagente en chat, WhatsApp, navegador, computer use y elaboración de documentos y presentaciones.

## What Changes

- Incorporar un arnés compartido de especialistas sin herramientas que trabajan en paralelo sobre el contexto autorizado de cada solicitud.
- Seleccionar automáticamente equipos para entregables, revisión de páginas y tareas complejas; permitir modo equipo o directo por solicitud.
- Entregar aportes al coordinador existente, que conserva herramientas, proveedor elegido, permisos, ejecución secuencial y HITL.
- Acotar concurrencia, entrada, salida, tiempo y cancelación; mostrar progreso y registrar resultados parciales sin registrar contenido sensible.
- Cubrir con pruebas las rutas Gemini/OpenAI, WhatsApp y Computer Use; documentar alcance y costo. No prometer mejora de latencia sin medición real.

## Capabilities

### New Capabilities
- `cross-surface-agent-teams`: preparación concurrente gobernada por superficie, con especialistas de contenido, estructura, evidencia y planificación.

### Modified Capabilities
Ninguna. El equipo de reuniones conserva su contrato y su historial.

## Impact

Código compartido, pipelines de chat/WhatsApp y clientes de Computer Use. Sin migraciones, IPC nuevo, dependencias ni credenciales nuevas. No objetivos: agentes con permisos propios, control simultáneo de una pantalla, delegación recursiva, publicación automática, Agents API hospedada ni elección de Codex fuera de Meeting Ops en esta entrega.
