## Why

El producto mantiene dos modelos para la misma idea —"lo que SofLIA sabe hacer
cuando se lo pides"—: los **Flujos de Trabajo** (`workflow-hub`, con motor,
casos, variantes y aprobaciones propias) y las **Skills** (catálogo unificado
con superficies, herramientas y espacio de trabajo). La duplicación ya produjo
daño visible: la pestaña "Flujos de Trabajo" lista 17 casos pendientes que son
**todos de Reuniones**, un dominio que desde hace versiones tiene su propio
panel (Meeting Ops) con la misma bandeja de aprobación y sincronización. El
usuario ve dos veces lo mismo y ninguna de las dos vistas es la canónica.

Además, el modelo de flujos nació atado a un solo canal: un workflow pasivo solo
sabe entregar por WhatsApp (`service-events.ts`), aunque el usuario esté sentado
frente a la computadora con la orbe disponible y tenga Telegram vinculado. Una
rutina de "noticias de IA a las 8:00" no puede elegir dónde aparece.

## What Changes

- **BREAKING** Se retira el Hub de Flujos de Trabajo completo: pestaña de
  ajustes, panel, servicio de main, handlers, los diez canales IPC
  `workflow-hub:*` y el servicio del renderer. Las aprobaciones de reuniones
  quedan únicamente en Meeting Ops, que ya las cubre.
- **BREAKING** Se retiran de WhatsApp y Telegram los comandos de flujos
  (`/flujos`, `/misflujos`, `/usarflujo`, `/ejecutarflujo`, `/crearflujo`,
  `/pendientes`, `/aprobar`, `/rechazar`). Los comandos de negocio (`/correo`,
  `/agenda`, `/seguimiento`, ...) sobreviven, pero resueltos como Skills.
- Los seis flujos activos que no son reuniones —Correo, Agenda, Seguimiento,
  Drive, Actualización de equipo y PC— pasan a ser **Skills del sistema
  declaradas en la base de datos** (`public.system_skills`), no en código, de
  modo que todos los usuarios las reciban sin publicar instalador y el catálogo
  se administre desde una fila.
- Esas Skills aportan **solo instrucciones**: las herramientas de Gmail,
  Calendar, Drive y Chat ya están en el catálogo runtime de las superficies, así
  que no hace falta concederles nada. La lista de herramientas que una fila del
  catálogo **nunca** puede concederse se endurece con las de escritura de Google
  Workspace, que hasta ahora no estaban cubiertas porque ninguna Skill tocaba
  ese dominio.
- Los "workflows pasivos" se renombran a **Skills pasivas** y dejan de ser un
  subtipo del motor de flujos: una Skill pasiva es una programación (cron) que
  ejecuta una Skill del catálogo —o un prompt libre— y entrega el resultado.
- Toda Skill, activa o pasiva, declara en qué **canales** está activa para el
  usuario: WhatsApp, Telegram y Computadora. La elección se persiste por usuario
  en la instancia Pulse Hub, de modo que WhatsApp (proceso main) y el Hub la
  resuelvan igual.
- La entrega de una Skill pasiva se enruta a los canales elegidos: mensaje por
  WhatsApp, mensaje por Telegram y, en Computadora, **la orbe aparece y lo
  dice en voz alta**.
- Telegram deja de ser un canal de comandos fijos y pasa a ser una superficie de
  Skills: ofrece el catálogo, acepta la invocación y ejecuta con las mismas
  guardas que WhatsApp.
- La Skill de Presentaciones queda disponible también en Telegram, con el mismo
  bloqueo en grupos que ya tiene en WhatsApp.

### No objetivos

- No se toca el motor de reuniones (`electron/meetings/**`) ni el panel Meeting
  Ops, salvo para cortar su dependencia del Hub de Flujos.
- No se crea un editor visual de Skills del sistema: se administran por fila,
  igual que hoy.
- No se añade voz bidireccional a la entrega proactiva: la orbe **anuncia**; la
  conversación posterior es la que ya existe.
- No se migran las variantes de workflow guardadas (`WorkflowVariant`): el
  modelo de Skills no tiene ese concepto y las variantes vivas son de reuniones.

## Capabilities

### New Capabilities

- `unified-skills-model`: modelo único de capacidad invocable. Retirada del Hub
  de Flujos de Trabajo, conversión de los flujos activos en Skills del catálogo
  y ampliación acotada de las herramientas que una fila puede conceder.
- `passive-skills`: Skills pasivas programadas —creación, edición, borrado y
  ejecución— sustituyendo a los workflows pasivos, con la misma regla de que una
  detección automática del sistema no se programa a mano.
- `skill-channel-activation`: activación por canal (WhatsApp, Telegram,
  Computadora) de Skills activas y pasivas, persistida por usuario, y
  enrutamiento de la entrega a los canales elegidos.
- `proactive-orb-announcements`: la orbe aparece y locuta el resultado de una
  Skill pasiva cuando el canal Computadora está activo, con las guardas de
  sesión que ya rigen la orbe.
- `telegram-skill-surface`: Telegram como superficie de Skills, con catálogo,
  invocación y guardas equivalentes a las de WhatsApp.

### Modified Capabilities

<!-- openspec/specs/ está vacío: no hay capacidades publicadas cuyas
     requisitos se modifiquen. Las capacidades relacionadas
     (system-skills-catalog, skills-registry) viven en cambios todavía no
     archivados y este cambio las extiende desde sus propias capacidades. -->

## Impact

**Código eliminado**

- `electron/workflow-hub/**`, `electron/workflow-hub-service.ts`,
  `electron/workflow-hub-handlers.ts`
- `electron/wa-agent/workflow-commands/**`,
  `electron/wa-agent/workflow-chat-commands.ts`,
  `electron/wa-agent/chat-commands/workflow-router.ts`,
  `electron/wa-agent/workflow-formatters.ts`
- `src/components/ops/WorkflowHubPanel.tsx`,
  `src/components/ops/workflow-hub-panel/**`
- `src/services/workflow-hub-service.ts`, `src/services/workflow-hub/**`

**Código modificado**

- IPC: se retiran los diez canales `workflow-hub:*` de
  `electron/preload/channel-group-2.ts` y `electron/preload/workflow-apis.ts`;
  se añaden `passive-skills:*` y `skill-channels:*`.
- `electron/task-scheduler/**`: la tarea programada pasa a referenciar
  `skillId` y `channels` en lugar de `workflowId`.
- `electron/main/service-events.ts`: el disparo de una tarea deja de asumir
  WhatsApp y consulta los canales de la regla.
- `electron/main/orb-window-controller.ts`, `electron/orb-ipc-handlers.ts`:
  anuncio proactivo desde main.
- `electron/telegram/**`: se retiran los mensajes y comandos de flujos y se
  incorpora la superficie de Skills.
- `src/shared/skills/types.ts`, `surface-tools.ts`, `system-catalog.ts`:
  superficies `telegram` y `escritorio`, y allowlist ampliada.
- `src/components/unified-settings/sections/IntegrationsSkillsSection.tsx`: la
  pestaña pasa de cuatro sub-pestañas a tres.
- `src/components/skills-settings/**`: sección de Skills pasivas y selector de
  canales.

**Datos**

- Migración nueva en `database/lia/` que siembra las seis Skills de flujos en
  `public.system_skills` (fuera del bloque de semilla generado desde código, que
  `verify:pr` compara) y crea `public.user_skill_channels` con RLS por usuario.
- Estado local: `scheduler-state.json` gana campos; se normaliza al cargar para
  que las tareas existentes sigan funcionando.

**Documentación**

- `docs/architecture/runtime-agents-manual.md`, `docs/ux/information-architecture.md`,
  `docs/product/functional-requirements.md`, `docs/architecture/system-overview.md`,
  `docs/security/security-and-privacy.md`, `CHANGELOG.md`.

**Riesgo principal**

Retirar el motor de flujos elimina el HITL estructurado que cubría las acciones
de Correo y Drive. Se compensa dejando esas acciones en manos del agente, que
tiene sus propias confirmaciones, y cerrando por lista explícita la posibilidad
de que una fila del catálogo se conceda escritura.
