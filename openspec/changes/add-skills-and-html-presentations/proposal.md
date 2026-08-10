## Why

Las capacidades reutilizables del producto están partidas en tres modelos incompatibles: los "flujos activos" son máquinas de estado que solo existen en WhatsApp (`electron/presentation-workflow/`, `electron/whatsapp-workflow-meetings.ts`), las herramientas del usuario son presets de prompt en la tabla `user_tools` que solo existen en el chat del Hub, y ninguna de las dos se puede invocar desde la otra superficie. El usuario no puede pedirle a SofLIA en el chat lo mismo que ya le pide por WhatsApp.

Además, la generación de presentaciones depende de Gamma: se envía el contenido a un tercero, el resultado es un enlace externo no editable, no respeta la identidad visual de la organización y el usuario no ve ni controla el proceso. La organización ya tiene su marca declarada en Supabase SOFIA (`organizations.brand_*`), y el producto ya sabe leer el DOM del navegador integrado, leer Drive y recibir archivos: falta convertir esa información en un entregable propio y gobernado.

## What Changes

### Skills como modelo único

- Unificar "flujos activos" y "herramientas del usuario" bajo un solo concepto llamado **Skill**: una capacidad nombrada, invocable y con contrato declarado, disponible tanto en el chat del Hub como en WhatsApp.
- Introducir dos clases de Skill: **del sistema** (declaradas en código, versionadas, pueden habilitar herramientas privilegiadas y prompts específicos) y **del usuario** (creadas desde la UI, solo aportan instrucciones y prompts de inicio, nunca declaran herramientas privilegiadas).
- **BREAKING**: migrar la tabla `user_tools` (Supabase LIA) a una tabla `skills` nueva con RLS por usuario, conservando los datos existentes. `user_tools` queda obsoleta y se retira tras la migración.
- Renombrar el concepto en UI, prompts y documentación: "Mis Herramientas" pasa a ser la biblioteca de Skills. Se conserva el nombre interno `skills` de memoria (`electron/memory/skills-*.ts`) desambiguándolo como *memoria aprendida*, sin fusionarlo con este modelo.
- Exponer un catálogo de Skills al agente de chat y al agente de WhatsApp con la misma resolución de disponibilidad y las mismas guardas de permisos por superficie.

### Skill del sistema: presentaciones ejecutivas en HTML/CSS

- **BREAKING**: eliminar la dependencia de Gamma. `electron/presentation-workflow/gamma.ts` y el uso de `GAMMA_API_KEY` se retiran; el comando `/presentacion` de WhatsApp pasa a usar el motor propio y entrega el archivo generado en lugar de un enlace de terceros.
- Generar la presentación como archivos HTML y CSS reales que SofLIA escribe en una carpeta de proyecto por presentación, no como un artefacto opaco.
- Alimentar la presentación desde las fuentes que el usuario ya tiene: archivos subidos al chat, documentos de Drive, el DOM de la pestaña activa del navegador integrado, una investigación previa o criterios dictados en la conversación.
- Aplicar automáticamente la identidad de la organización (colores de marca, tipografía, logo, favicon y banner) leída de Supabase SOFIA, con degradación explícita a un tema neutro cuando la organización no tiene branding habilitado.
- Permitir que el usuario itere en lenguaje natural sobre una presentación ya generada: SofLIA modifica los archivos existentes en lugar de regenerar todo.
- Exportar la presentación a un único archivo HTML autocontenido (estilos incrustados e imágenes embebidas) para entregarla por WhatsApp o por correo conservando transiciones y animaciones. **No** se exporta a PDF: imprimir aplanaría justo el movimiento que motiva usar HTML.

### Panel de trabajo de la presentación

- Añadir un panel lateral derecho donde el usuario ve en vivo qué archivo está escribiendo SofLIA y su contenido, con un control de reproducción que abre la presentación renderizada.
- Renderizar la presentación en dos superficies: una vista previa embebida en el chat mediante `iframe` con sandbox estricto sobre un protocolo local propio, y una vista nativa a pantalla completa para presentar.
- Permitir ocultar el panel sin detener el trabajo y volver a mostrarlo desde el menú de herramientas del encabezado del chat (el ícono de mundo), junto a Navegador, Reuniones y Registro de decisiones.

### Herramientas de edición de código acotadas

- Añadir herramientas de lectura y edición de archivos **acotadas al workspace de la skill activa**: listar, leer, escribir y editar por reemplazo exacto dentro de la carpeta del proyecto, sin acceso libre al disco del usuario.
- Emitir eventos de progreso por archivo para que el panel refleje la escritura mientras ocurre.

### No objetivos

No se implementa un editor de código manual para el usuario, ni ejecución de JavaScript de la presentación con acceso a IPC, red externa o `node`, ni exportación a PowerPoint, ni plantillas comerciales de terceros, ni edición colaborativa en tiempo real, ni publicación de la presentación en internet, ni skills del usuario que declaren herramientas privilegiadas o ejecuten código arbitrario, ni migración del modelo de memoria aprendida (`electron/memory/skills-*.ts`) a la tabla `skills`.

## Capabilities

### New Capabilities

- `skills-registry`: modelo único de Skill del sistema y del usuario, catálogo, persistencia con RLS, migración desde `user_tools`, resolución de disponibilidad por superficie y guardas de permisos.
- `presentation-authoring`: skill del sistema que produce presentaciones ejecutivas en HTML/CSS a partir de archivos, Drive, DOM del navegador, investigación o criterios del usuario; carpeta de proyecto por presentación, iteración por conversación, exportación a un HTML autocontenido y entrega por WhatsApp sin Gamma.
- `presentation-workspace-panel`: panel lateral con escritura de código en vivo, control de reproducción, vista previa embebida en `iframe` con sandbox, vista nativa a pantalla completa, y ocultar/mostrar desde el menú de herramientas del chat.
- `skill-workspace-file-tools`: herramientas de archivo acotadas al workspace de la skill activa, con validación de rutas, límites de tamaño y eventos de progreso.
- `organization-branding`: resolución gobernada de la identidad visual de la organización desde Supabase SOFIA, con caché acotada, descarga local de recursos y tema neutro de respaldo.

### Modified Capabilities

<!-- Sin deltas: openspec/specs/ no contiene todavía capacidades sincronizadas.
     El cambio de comportamiento del flujo `/presentacion` de WhatsApp queda
     cubierto dentro de `presentation-authoring`. -->

## Impact

**Datos.** Nueva tabla `skills` en Supabase LIA con RLS por `user_id` y migración de los datos de `user_tools`; `user_tools` queda obsoleta. Sin cambios de esquema en SOFIA: el branding se lee de columnas existentes en `organizations`.

**IPC.** Nuevos canales para el ciclo de vida del workspace de presentaciones, las herramientas de archivo acotadas, los eventos de progreso de escritura y la vista nativa a pantalla completa. Cada canal cruza servicio main, handler, allowlist de preload y wrapper tipado del renderer, y se refleja en `electron/__tests__/preload/channel-cases.ts`.

**Código.** Afecta `src/services/tools-service.ts` y `src/services/tools/`, `src/components/ToolLibrary.tsx`, `ToolEditorModal.tsx` y `src/components/tool-library/`, `src/adapters/desktop_ui/chat-ui/useChatTools.ts` y el encabezado del chat, `src/services/gemini-tools/` y `src/services/gemini-chat/tool-dispatch.ts`, `src/services/openai-chat/`, `src/app/AppWorkspace.tsx` y `src/components/browser/BrowserWorkspaceLayout.tsx`, y en main `electron/presentation-workflow/`, `electron/wa-agent/chat-commands.ts`, `electron/wa-tools/` y `electron/skill-workspace/`.

**Permisos y seguridad.** Se registra un protocolo local de solo lectura restringido a la carpeta de presentaciones bajo `userData`; el `iframe` se sirve con sandbox y sin acceso a `node`, IPC ni red externa. Las herramientas de archivo se validan contra el workspace activo para impedir escapes de ruta. Los recursos de marca se descargan solo desde el dominio de Supabase SOFIA configurado.

**Empaquetado.** Sin dependencias nuevas obligatorias: el render usa Chromium ya presente y la exportación es manipulación de texto y base64. Se retira la variable de entorno `GAMMA_API_KEY` de configuración y documentación.

**Documentación.** Actualizar `docs/architecture/runtime-agents-manual.md` (catálogo de herramientas y guardas), `docs/architecture/ipc-and-integrations.md`, `docs/operations/configuration.md` (baja de `GAMMA_API_KEY`), `docs/product/functional-requirements.md`, `docs/product/traceability-matrix.md`, `docs/security/security-and-privacy.md`, `docs/quality/test-strategy-and-inventory.md` y `ai-specs/`.

**Rollback.** La skill de presentaciones y el panel se pueden desactivar por bandera dejando el resto del catálogo de Skills operativo; la tabla `skills` conserva una vista de compatibilidad hacia `user_tools` durante una release para permitir revertir el renderer sin pérdida de datos.
