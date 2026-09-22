## Why

SofLIA necesita convertir el análisis del repositorio Codex en una capacidad runtime utilizable: especialistas que analizan reuniones con permisos acotados, cancelación y evidencia. Hoy no existe un ciclo multiagente visible y recuperable en Meeting Ops.

## What Changes

- Añadir un arnés en main con dos especialistas paralelos y un coordinador, proveedores Gemini y Codex app-server, límites, herramientas de lectura y seguimiento de ejecución.
- Añadir persistencia local cifrada por usuario y organización, recuperación explícita, invalidación de sesión y confirmación vinculada al resultado para crear un borrador Meeting Ops.
- Añadir contratos IPC completos y panel de ejecución integrado en Meeting Ops.
- Reutilizar los servicios existentes de reuniones para revisión y sincronización posterior. Los agentes no reciben shell, Git, skills de desarrollo ni credenciales de negocio.
- Configurar Codex desde un ejecutable seleccionado explícitamente, hogar aislado y negociación de capacidades sin entornos de ejecución. Fallar cerrado ante incompatibilidad.

No objetivos: copiar el árbol Rust, sustituir los agentes actuales, desplegar servicios remotos, empaquetar binarios de terceros ni activar capacidades experimentales no verificadas. Agents API hospedada no es requisito de esta integración local.

## Capabilities

### New Capabilities

- `runtime-multiagent-harness`: orquestación, herramientas, identidad, persistencia, cancelación y revisión de resultados.
- `codex-runtime-adapter`: transporte app-server aislado y validación de contrato.

### Modified Capabilities

Ninguna; la experiencia se añade al flujo existente de Meeting Ops.

## Impact

Electron main, preload, wrapper y panel React; almacenamiento local cifrado sin migraciones remotas. Sin dependencia nueva. Codex se configura por instalación y usa su autenticación separada. Se documentarán límites, licencia Apache-2.0 del upstream y ausencia de redistribución de binarios.
