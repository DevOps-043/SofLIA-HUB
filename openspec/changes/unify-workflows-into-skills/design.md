## Context

Ver `proposal.md` — Why. Lo que aquí importa es el estado del código y las tres
restricciones que condicionan el enfoque.

**Estado actual relevante**

- `electron/workflow-hub/**` implementa un motor propio: definiciones,
  ejecución, casos, variantes, decisiones HITL y reglas pasivas. Su único
  consumidor de casos vivo es Reuniones, ya cubierto por `electron/meetings/**`
  y el panel Meeting Ops.
- Las reglas pasivas no son un almacén propio: `savePassiveRule` delega en
  `TaskScheduler.upsertTask`, y `PassiveWorkflowRule` es una **proyección** de
  `ScheduledTaskInfo`. El estado real vive en `userData/scheduler-state.json`.
- El disparo (`service-events.ts:17-25`) tiene el canal cableado: si el modo es
  `workflow` ejecuta y manda WhatsApp; si no, inyecta el prompt al agente de
  WhatsApp. No hay ningún punto donde se pregunte "¿por dónde entrego esto?".
- Las Skills ya tienen catálogo unificado con acotado en cliente
  (`src/shared/skills/system-catalog.ts`) y allowlist por superficie
  (`surface-tools.ts`). Ese acotado es la frontera de privilegio del catálogo
  remoto.
- `electron/telegram/**` no tiene bucle de agente: `commands.ts` mapea comandos
  fijos a llamadas del `workflowHubService`. Al retirarlo, el canal se queda sin
  contenido si no se le da otro.

**Restricciones**

1. `npm run verify:pr` compara el bloque de semilla de
   `database/lia/migrations/system-skills-catalog.sql` con el registro en
   código (`scripts/quality/system-skills-seed.mjs`). Cualquier Skill nueva
   sembrada dentro de ese bloque rompería la comprobación.
2. `src/shared/skills/**` es código compartido por main y renderer y **no puede
   leer `import.meta.env`** (ya causó que se inlineara el entorno completo en un
   chunk de main).
3. Toda operación IPC nueva debe cruzar servicio → handler → allowlist del
   preload → wrapper tipado (AGENTS.md).

## Goals / Non-Goals

**Goals**

- Que quede **un** almacén de programaciones y **un** catálogo de capacidades.
- Que el destino de una entrega sea un dato de la regla, no una línea de código.
- Que la ampliación de la allowlist de herramientas sea auditable en un solo
  archivo y esté cubierta por pruebas que fijen lo prohibido.
- Que las programaciones existentes sobrevivan sin intervención del usuario.

**Non-Goals**

- Reescribir el motor de reuniones o Meeting Ops.
- Dar a Telegram paridad total con WhatsApp (multimedia, grupos avanzados,
  nodos remotos). Sólo la superficie de Skills.
- Un planificador distribuido: la programación sigue siendo local al escritorio,
  con `node-cron`.

## Decisions

### D1. Las Skills de flujos van a la base de datos, en una migración aparte

**Decisión**: sembrar las seis Skills (`sistema:correo`, `sistema:agenda`,
`sistema:seguimiento`, `sistema:drive`, `sistema:actualizacion-equipo`,
`sistema:pc`) en un archivo nuevo,
`database/lia/migrations/system-skills-flujos.sql`, y **no** tocar el bloque
`<<< SEMILLA GENERADA` de `system-skills-catalog.sql`.

**Por qué**: ese bloque es generado y verificado contra el registro en código.
Sembrar allí obligaría a declarar las Skills en código —justo lo contrario de lo
pedido— o a romper `verify:pr`. Un archivo aparte deja el generador intacto y
hace explícito que estas seis filas se administran solo desde la base.

**Alternativa descartada**: declararlas en `SYSTEM_SKILLS` y dejar que el
generador las siembre. Se descartó porque ata el catálogo a publicar versión,
que es el problema que el usuario pidió resolver.

**Consecuencia aceptada**: estas seis Skills no tienen respaldo en la versión
instalada. Si la base no responde, no aparecen. Es coherente con el modelo: el
respaldo en código existe para las Skills cuyo contrato está atado a un runtime
local (Presentaciones), no para las que son solo instrucciones.

### D2. La allowlist NO se amplía: las seis Skills solo aportan instrucciones

**Decisión**: `ALLOWED_BY_SURFACE` conserva únicamente las herramientas del
espacio de trabajo. Las seis Skills de flujos se siembran con `tools: []`.
`NEVER_FROM_SKILLS` sí se amplía con las herramientas de escritura de Google
Workspace (`gchat_send_message`, `gmail_trash`, `gmail_modify_labels`,
`gmail_create_label`, `gmail_delete_label`, `gmail_batch_empty_label`,
`gmail_empty_all_labels`, `gmail_apply_organization_plan`,
`gmail_undo_organization_plan`, `drive_upload`, `drive_create_folder`,
`google_calendar_create`, `google_calendar_delete`).

**Por qué**: la premisa inicial —que estas Skills necesitarían que se les
concedieran herramientas de Google— es falsa. El catálogo runtime del agente de
chat (§2.5 del manual, 84 declaraciones) y el de WhatsApp **ya incluyen** Gmail,
Calendar, Drive y Chat por defecto. Una Skill que las declarase no concedería
nada que el turno no tuviera ya, y para conseguirlo habría que abrir la
allowlist a un dominio entero. Lo que estas Skills aportan —y lo que las
distingue del flujo que sustituyen— son sus **instrucciones**: qué revisar, en
qué orden, con qué criterio y qué no hacer.

**Consecuencia**: el cambio no mueve la frontera de privilegio en la dirección
peligrosa; sólo la endurece. Ampliar `NEVER_FROM_SKILLS` es gratuito hoy
(ninguna fila las declara) y cierra la tentación evidente de mañana: con Skills
cubriendo el dominio del correo, declarar `gmail_send` en una fila para "que
además lo mande" sería el siguiente paso natural, y dejaría un envío sin
confirmación gobernado por una fila de base de datos.

**Consecuencia sobre el alcance**: la Skill de Correo **revisa y propone**; el
archivado y el envío los ejecuta el agente con sus propias confirmaciones. Es
una reducción real frente al workflow de Correo, que aplicaba su plan tras una
aprobación estructurada. Se documenta como cambio de comportamiento.

**Alternativa descartada**: conceder lectura desde la fila para que la Skill sea
autosuficiente. Se descartó al comprobar que no aporta capacidad y sí abre
superficie.

### D3. La Skill pasiva sigue viviendo en el `TaskScheduler`

**Decisión**: no crear un almacén nuevo. `ScheduledTaskInfo` gana `skillId` y
`channels`; `workflowId`/`workflowInput` se retiran y el normalizador los
traduce al cargar. `PassiveSkillRule` sustituye a `PassiveWorkflowRule` como
proyección del mismo registro.

**Por qué**: el estado ya está ahí, persistido y con cron activo. Un almacén
nuevo obligaría a una migración de datos de usuario con riesgo de perder
programaciones, para no ganar nada: lo que cambia es qué referencia la tarea y a
dónde entrega, no cómo se programa.

**Migración de datos**: `normalizeScheduledTask` mapea
`workflowId: 'correo'` → `skillId: 'sistema:correo'`, y una tarea sin `channels`
recibe `['whatsapp']` si tiene `phoneNumber`, o `['escritorio']` si no. Es la
regla de "se entrega por el canal desde el que se creó" del spec.

### D4. Los canales del usuario viven en la base, no en el estado local

**Decisión**: tabla `public.user_skill_channels (user_id, skill_id, channels[])`
con RLS por `auth.uid()`, y un caché de sesión en cada proceso.

**Por qué**: la elección la hace el usuario en el Hub y la tienen que respetar
el agente de WhatsApp y el de Telegram, que corren en main y resuelven identidad
por número de teléfono / chat id, no por sesión del renderer. Un archivo en
`userData` no cruza esa frontera, y duplicarlo en los dos lados los haría
divergir. Es el mismo razonamiento por el que el catálogo del sistema ya está en
la base.

**Ausencia = todos los canales del catálogo.** Una fila que no existe no puede
retirar una capacidad; sólo una elección declarada la retira. Es la misma
asimetría que ya rige el catálogo del sistema y la bandera de entorno, y por el
mismo motivo: un fallo de lectura no puede dejar al usuario sin sus Skills.

### D5. El anuncio proactivo es un push de main a la orbe, con relevo

**Decisión**: main expone `announceOnOrb(text, meta)`, que crea o muestra la
ventana de la orbe con `showInactive()` y envía `orb:announce`. Se reutiliza el
patrón `pendingWake` ya existente: si la ventana aún no montó React, el anuncio
queda en `pendingAnnouncement` y el renderer lo reclama con
`orb:get-pending-announcement` al montarse.

**Por qué**: el patrón existe justamente porque un push a una ventana recién
creada se pierde. Repetir la solución conocida evita reintroducir esa carrera.

**Cola**: los anuncios se encolan en main y se entregan de uno en uno; el
renderer confirma con `orb:announcement-finished` al terminar la locución. Sin
cola, dos rutinas a las 8:00 se pisarían la voz.

**Foco**: `showInactive()` —nunca `show()`/`focus()`— es lo que cumple "no
secuestra el equipo".

### D6. Telegram recibe el mismo enrutador de comandos que WhatsApp, no uno propio

**Decisión**: extraer de `wa-agent/chat-commands` la resolución de Skills a un
módulo compartido por canal (`electron/skill-catalog/channel-skills.ts`) y que
Telegram lo consuma con su propio contexto de principal.

**Por qué**: el spec exige que una Skill retirada no siga viva en un canal. Dos
resoluciones separadas divergen; ya pasó con el catálogo antes de centralizarlo
en `systemSkillsFor`.

**Alcance acotado**: Telegram ejecuta la Skill a través del mismo agente que
WhatsApp, con `provider: 'telegram'` en la autorización del
`communicationHubService`. No se le da acceso a nodos remotos ni a control del
equipo.

### D7. `escritorio` es un canal, no una superficie

**Decisión**: `SkillSurface` gana solo `'telegram'`. El canal Computadora
(`escritorio`) se resuelve sobre la superficie `chat` mediante un mapeo
explícito `channelToSurface`.

**Por qué**: la superficie es el eje **técnico** —de ella dependen la allowlist
de herramientas y el catálogo que se resuelve—, y la orbe y el chat del Hub
comparten agente, catálogo y allowlist. Añadir una cuarta superficie idéntica a
`chat` obligaría a duplicar cada entrada de `ALLOWED_BY_SURFACE` y a mantener
dos listas que sólo pueden divergir. El canal es el eje **de producto**: lo que
el usuario elige. Separarlos deja que el producto crezca en canales sin tocar la
frontera de privilegio.

**Consecuencia**: una Skill disponible en el chat del Hub lo está también en la
orbe, y el canal Computadora gobierna dónde **aparece** y dónde **entrega**, no
qué herramientas obtiene.

## Risks / Trade-offs

- **[Ampliar la allowlist mueve una frontera de privilegio]** → Lista explícita
  por herramienta (D2), `NEVER_FROM_SKILLS` ampliada en el mismo commit, y una
  prueba que falla si una herramienta de escritura entra en la allowlist.
- **[La Skill de Correo pierde las acciones de archivado que tenía el workflow]**
  → Reducción deliberada y documentada (D2). Se declara en el CHANGELOG como
  cambio de comportamiento, no como equivalencia.
- **[Las seis Skills nuevas dependen de que la base responda]** → Aceptado y
  documentado (D1). El fallo degrada a "no aparecen", nunca a error bloqueante,
  porque `loadSystemSkillRows` ya devuelve `null` y el merge respeta el código.
- **[Un anuncio proactivo puede interrumpir al usuario]** → `showInactive`, cola
  serializada, silenciar y cerrar siempre disponibles, y guarda de sesión.
- **[Borrar el `workflow-hub` puede romper Reuniones por una dependencia oculta]**
  → `electron/workflow-hub/meeting-execution.ts` es el único puente; se verifica
  que Meeting Ops no invoque ningún canal `workflow-hub:*` antes de borrar, y la
  suite de reuniones (`workflow-hub-service.test.ts` incluida) se reescribe
  contra el servicio de reuniones directamente.
- **[Telegram gana capacidad de ejecutar Skills, ampliando su superficie de ataque]**
  → Se mantiene la autorización por `communicationHubService` y la allowlist de
  la superficie; ninguna Skill obtiene en Telegram algo que no obtenga en
  WhatsApp.

## Migration Plan

1. **Base de datos primero**: ejecutar `system-skills-flujos.sql` y
   `user-skill-channels.sql` en la instancia Pulse Hub. Ambas son idempotentes
   (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`). Con la versión anterior
   instalada no tienen efecto: las filas nuevas sólo las lee el catálogo, que
   ignora identificadores que no conoce.
2. **Publicar la versión**: al arrancar, el normalizador del scheduler traduce
   las tareas existentes (D3) y las persiste ya normalizadas.
3. **Rollback**: revertir la versión devuelve el Hub de Flujos. Las tareas
   normalizadas conservan `workflowId` como campo heredado durante una versión
   para que el rollback no las pierda; se retira en la siguiente.
   `DROP TABLE public.user_skill_channels` deja al producto resolviendo por
   catálogo, que es el comportamiento por defecto.

## Open Questions

- Si el usuario tiene varios equipos con sesión iniciada, un anuncio con canal
  Computadora suena hoy en todos los que estén abiertos. Acotarlo a un equipo
  concreto necesita identidad de dispositivo, que no existe todavía y no cambia
  ni las specs ni el desglose de tareas.
