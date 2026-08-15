## 1. Modelo compartido de canales y superficies

- [x] 1.1 Ampliar `SkillSurface` en `src/shared/skills/types.ts` con `'telegram'` y actualizar `SKILL_SURFACES`. `escritorio` NO es una superficie: es el canal que se resuelve sobre la superficie `chat` (ver `design.md` — D7).
- [x] 1.2 Añadir en el mismo módulo el tipo `SkillChannel = 'whatsapp' | 'telegram' | 'escritorio'`, la lista `SKILL_CHANNELS` con su etiqueta en español, `isSkillChannel` y el mapeo `channelToSurface` / `surfaceToChannel`.
- [x] 1.3 Añadir la entrada de `telegram` a `ALLOWED_BY_SURFACE` en `src/shared/skills/surface-tools.ts`, con el mismo contenido que las demás. NO se amplía la allowlist (ver `design.md` — D2).
- [x] 1.4 Ampliar `NEVER_FROM_SKILLS` con las herramientas de escritura de Google Workspace: `gchat_send_message`, `gmail_trash`, `gmail_modify_labels`, `gmail_create_label`, `gmail_delete_label`, `gmail_batch_empty_label`, `gmail_empty_all_labels`, `gmail_apply_organization_plan`, `gmail_undo_organization_plan`, `drive_upload`, `drive_create_folder`, `google_calendar_create` y `google_calendar_delete`.
- [x] 1.5 Aceptar `'telegram'` como superficie válida al leer una fila en `src/shared/skills/system-catalog.ts` (`readSystemSkillRow`), vía `isSkillSurface`.
- [x] 1.6 Crear `src/shared/skills/channels.ts` con `catalogChannelsForSkill`, `resolveChannelsForSkill`, `isSkillActiveOnChannel`, `skillsActiveOnSurface` y `normalizeChannels`.
- [x] 1.7 Pruebas del módulo puro: una fila que declara una herramienta de escritura no la recibe en ninguna superficie; una fila con superficie `telegram` se resuelve para Telegram y no para chat; la ausencia de elección de canales resuelve a todos los del catálogo; una elección no puede añadir un canal que el catálogo no declara.

## 2. Base de datos

- [x] 2.1 Escribir `database/lia/migrations/system-skills-flujos.sql` sembrando las seis Skills de `design.md` — D1, idempotente y con bloque de ROLLBACK. No tocar el bloque `<<< SEMILLA GENERADA` de `system-skills-catalog.sql`.
- [x] 2.2 Redactar las instrucciones de cada una de las seis Skills en español, con su objetivo, sus límites y la advertencia de que no ejecutan acciones destructivas por su cuenta.
- [x] 2.3 Escribir `database/lia/migrations/user-skill-channels.sql`: tabla `public.user_skill_channels` con clave `(user_id, skill_id)`, `channels text[]`, RLS por `auth.uid()` en las cuatro operaciones, y bloque de verificación.
- [x] 2.4 Añadir ambas tablas a `database/lia/snapshots/schema.sql` con el formato del snapshot existente.
- [x] 2.5 Comprobar que `node scripts/quality/system-skills-seed.mjs` sigue en verde: el generador no debe ver las seis filas nuevas.

## 3. Canales por usuario

- [x] 3.1 Crear `src/services/skills/skill-channels-store.ts`: lee y escribe `public.user_skill_channels` para el usuario en sesión, con caché de sesión y `null` ante fallo.
- [x] 3.2 Crear `electron/skill-catalog/skill-channels-store.ts` con `hub-db-client.ts`, resolviendo por `userId` del principal del canal.
- [x] 3.3 Añadir `resolveChannelsForSkill(skill, stored)` en `src/shared/skills/`: intersección de los canales elegidos con las superficies del catálogo; ausencia de fila = todos los canales del catálogo.
- [x] 3.4 Cablear `src/services/skills/catalog.ts` para acotar el catálogo resuelto por los canales del usuario.
- [x] 3.5 Pruebas: elección que retira un canal; elección que pide un canal no declarado por el catálogo (no lo concede); fallo de lectura (se resuelve por catálogo); aislamiento entre usuarios en RLS.

## 4. Skills pasivas en main

- [x] 4.1 Sustituir en `electron/task-scheduler/types.ts` `workflowId`/`workflowInput` por `skillId` y `channels`, conservando `workflowId` como campo heredado de solo lectura.
- [x] 4.2 Traducir en `electron/task-scheduler/normalizer.ts` las tareas antiguas: `workflowId` → `skillId` equivalente, y `channels` por omisión según `design.md` — D3.
- [x] 4.3 Crear `electron/passive-skills/` con el servicio: `listRules`, `saveRule`, `deleteRule` sobre el `TaskScheduler`, y el mapeo `ScheduledTaskInfo` → `PassiveSkillRule`.
- [x] 4.4 Rechazar en `saveRule` la programación de una capacidad automática del sistema, con el mensaje de la spec.
- [x] 4.5 Rechazar en `saveRule` una regla sin ningún canal de entrega activo.
- [x] 4.6 Crear `electron/passive-skills-handlers.ts` con los canales `passive-skills:list`, `:save` y `:delete`.
- [x] 4.7 Añadir esos canales a la allowlist de `electron/preload/channel-group-2.ts` y el wrapper tipado en `electron/preload/` que sustituye a `workflow-apis.ts`.
- [x] 4.8 Pruebas: normalización de una tarea antigua; rechazo de capacidad automática; rechazo sin canales; borrado que detiene el cron.

## 5. Entrega por canal

- [x] 5.1 Crear `electron/passive-skills/delivery.ts` con `deliverToChannels(result, channels, context)`: itera los canales y aísla el fallo de cada uno.
- [x] 5.2 Reescribir el manejador de `task-triggered` en `electron/main/service-events.ts` para ejecutar la Skill y delegar la entrega en `deliverToChannels`, sin asumir WhatsApp.
- [x] 5.3 Implementar la entrega por WhatsApp reutilizando `waService.sendText`, respetando el estado de conexión.
- [x] 5.4 Implementar la entrega por Telegram con el servicio de Telegram y el chat vinculado del usuario.
- [x] 5.5 Pruebas: entrega en un canal; entrega en varios; un canal caído no impide los demás; ningún canal disponible deja traza y no lanza.

## 6. Anuncio proactivo en la orbe

- [x] 6.1 Añadir a `electron/main/orb-window-controller.ts` la cola de anuncios y `announceOnOrb(text, meta)`, que crea o muestra la ventana con `showInactive()`.
- [x] 6.2 Reutilizar el patrón `pendingWake` para `pendingAnnouncement`, con el canal `orb:get-pending-announcement`.
- [x] 6.3 Añadir el push `orb:announce` y el acuse `orb:announcement-finished` en `electron/orb-ipc-handlers.ts`, y ambos a la allowlist del preload.
- [x] 6.4 Respetar la guarda de sesión: sin sesión no se crea la ventana, el anuncio se descarta y queda traza; al cerrarse la sesión se vacía la cola.
- [x] 6.5 Consumir `orb:announce` en `src/components/orb/useOrbConversation.ts`: mostrar el texto, locutarlo con la voz configurada y avisar al terminar.
- [x] 6.6 Dejar el anuncio en el contexto de la conversación de la orbe para que el usuario pueda preguntar por él.
- [x] 6.7 Pruebas: sin sesión no aparece; dos anuncios simultáneos se serializan; el fallo de TTS conserva el texto visible.

## 7. Telegram como superficie de Skills

- [x] 7.1 Extraer de `electron/wa-agent/chat-commands/skills.ts` la resolución por canal a `electron/skill-catalog/channel-skills.ts`, parametrizada por superficie.
- [x] 7.2 Cablear WhatsApp al módulo extraído sin cambiar su comportamiento observable.
- [x] 7.3 Sustituir en `electron/telegram/commands.ts` los comandos de flujos por la invocación de Skills, resolviendo el principal con `communicationHubService`.
- [x] 7.4 Reescribir `electron/telegram/messages.ts`: retirar `buildWorkflowCatalogMessage`, `buildRunsMessage` y las referencias a casos; añadir el catálogo de Skills.
- [x] 7.5 Actualizar `buildTelegramHelpMessage` para que no anuncie comandos inexistentes.
- [x] 7.6 Retirar `workflowHubService` de `electron/telegram/types.ts` y de su contexto.
- [x] 7.7 Añadir `telegram` a las superficies de la Skill de Presentaciones (fila del catálogo y registro en código), conservando `blocked_in_groups`.
- [x] 7.8 Pruebas: catálogo en Telegram; Skill bloqueada en grupos rechazada; chat no autorizado rechazado; herramienta no concedible descartada.

## 8. Retirada del Hub de Flujos de Trabajo

- [x] 8.1 Comprobar que Meeting Ops no invoca ningún canal `workflow-hub:*` y que `electron/meetings/**` no depende de `electron/workflow-hub/**`.
- [x] 8.2 Borrar `electron/workflow-hub/**`, `electron/workflow-hub-service.ts` y `electron/workflow-hub-handlers.ts`.
- [x] 8.3 Borrar `electron/wa-agent/workflow-commands/**`, `workflow-chat-commands.ts`, `chat-commands/workflow-router.ts` y `workflow-formatters.ts`.
- [x] 8.4 Sustituir `electron/wa-agent/passive-workflows/**` por `electron/wa-agent/passive-skills/**`, conservando el análisis de intención y de horario.
- [x] 8.5 Responder a los comandos retirados con el mensaje de reubicación de la spec, en WhatsApp y Telegram.
- [x] 8.6 Retirar los diez canales `workflow-hub:*` de `electron/preload/channel-group-2.ts` y borrar `electron/preload/workflow-apis.ts`.
- [x] 8.7 Retirar `workflowHubService` de `service-factory.ts`, `service-modules.ts`, `startup.ts`, `whatsapp-agent-init.ts` y `service-events.ts`.
- [x] 8.8 Borrar `src/components/ops/WorkflowHubPanel.tsx`, `src/components/ops/workflow-hub-panel/**`, `src/services/workflow-hub-service.ts` y `src/services/workflow-hub/**`.
- [x] 8.9 Borrar o reescribir las pruebas de `electron/__tests__/workflow-*` y `whatsapp-workflow-*` que cubrían el motor retirado; conservar la cobertura de reuniones contra el servicio de reuniones.
- [x] 8.10 Actualizar `electron/__tests__/preload/channel-cases.ts` y `source-verification-cases.ts`, que hoy exigen al menos seis canales `workflow-hub:*`.

## 9. Interfaz

- [x] 9.1 Retirar la sub-pestaña "Flujos de Trabajo" de `src/components/unified-settings/sections/IntegrationsSkillsSection.tsx` y ajustar el texto de cabecera.
- [x] 9.2 Añadir a `src/components/skills-settings/SkillsSettingsPanel.tsx` la sección de Skills pasivas: lista, alta, edición y borrado.
- [x] 9.3 Crear el editor de Skill pasiva con nombre, descripción, programación en lenguaje claro y selector de canales.
- [x] 9.4 Añadir el selector de canales a cada Skill del catálogo, mostrando solo los canales que su superficie declara.
- [x] 9.5 Marcar las capacidades automáticas del sistema como tales, sin controles de programación.
- [x] 9.6 Pruebas de renderer: el selector no ofrece canales no declarados; guardar sin canales advierte; la lista refleja la última ejecución.

## 10. Documentación y verificación

- [x] 10.1 Actualizar `docs/architecture/runtime-agents-manual.md`: retirar el Hub de Flujos, documentar Skills pasivas, canales y anuncio proactivo.
- [x] 10.2 Actualizar `docs/ux/information-architecture.md` con las tres sub-pestañas.
- [x] 10.3 Actualizar `docs/product/functional-requirements.md` y `docs/architecture/system-overview.md`.
- [x] 10.4 Documentar en `docs/security/security-and-privacy.md` la allowlist ampliada y qué sigue prohibido.
- [x] 10.5 Añadir la entrada del cambio a `CHANGELOG.md`, marcando la reducción de alcance de Correo como cambio de comportamiento.
- [x] 10.6 Ejecutar `npm run typecheck`, las pruebas y `npm run harness:validate`, y dejar la evidencia en `verification.md` (incluidos los dos fallos preexistentes comprobados en árbol limpio).
