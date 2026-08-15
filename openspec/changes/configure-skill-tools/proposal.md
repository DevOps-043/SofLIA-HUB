## Why

Hoy el usuario no decide qué puede tocar cada Skill. El catálogo de herramientas
del turno lo fija la superficie —unas 90 declaraciones en el chat— y una Skill
solo puede *añadir* lo que su fila declare, acotado por una lista de
prohibiciones. El resultado es que todas las Skills ven casi todo: la de Correo
puede abrir el navegador y la de Presentaciones puede tocar el calendario.

Eso hace daño en tres frentes: **fiabilidad** (un catálogo enorme empeora la
elección del modelo y alarga los turnos), **coste** (cada declaración va en cada
petición) y **control** (el usuario no puede decir "esta rutina que corre sola a
las 8 solo lee mi correo, nada más").

La petición es al revés de la que resolvió el cambio anterior, y por eso se
puede conceder: allí quien declaraba herramientas era una **fila del catálogo**
—escrita por otro— y por eso se blindó con `NEVER_FROM_SKILLS`. Aquí quien elige
es **el usuario, sobre su propia Skill, en su configuración y con su sesión**.
Son dos contextos de confianza distintos y necesitan dos listas distintas.

## What Changes

- Cada Skill —del sistema o del usuario— admite una **selección de herramientas**
  hecha por el usuario. La selección **acota** el catálogo del turno: sin
  selección, la Skill sigue viendo lo que ve hoy.
- Las **Skills pasivas** admiten su propia selección, que por omisión hereda la
  de su Skill. Una rutina desatendida es justo donde más importa acotar.
- Nuevo **registro de herramientas** con nombre y descripción en español,
  agrupadas por dominio (Correo, Calendario, Drive, Chat, Navegador,
  Computadora, Archivos, Proyectos, Imágenes, Espacio de trabajo), para que la
  elección se haga sobre conceptos y no sobre identificadores internos.
- **Búsqueda web** se expone como un eje **aparte**, no como una herramienta.
  En Gemini el grounding de Google Search **no se puede mezclar** con function
  calling en la misma petición: hoy se decide con una heurística sobre el texto
  del mensaje. Pasa a poder fijarse por Skill en tres estados: automática (la
  heurística de siempre), siempre o nunca.
- Nueva lista `USER_SELECTABLE_TOOLS`, más amplia que `NEVER_FROM_SKILLS`:
  incluye correo, calendario, Drive, navegador y control de la computadora,
  porque elegirlas para uno mismo es legítimo. Sigue **fuera** lo que no es una
  decisión por Skill sino de la superficie o del canal.
- **BREAKING (datos)** `user_skill_channels` se consolida en
  `user_skill_settings`, que guarda canales, herramientas y búsqueda web con la
  misma clave `(user_id, skill_id)`. Se migran las filas existentes.

### No objetivos

- La selección **no amplía** lo que la superficie concede ni lo que el canal
  autoriza: acota. Marcar control de la computadora en Telegram no lo habilita.
- **No se retiran las confirmaciones**: seleccionar `execute_command` o borrado
  no elimina su HITL. Elegir qué puede usar una Skill no es autorizar por
  adelantado lo que haga con ello.
- No se toca `NEVER_FROM_SKILLS`: una fila del catálogo sigue sin poder
  concederse nada de eso.

## Capabilities

### New Capabilities

- `skill-tool-selection`: selección de herramientas por Skill y por Skill
  pasiva, su resolución contra la superficie y el canal, y los límites que
  sobreviven a la elección del usuario.
- `tool-registry`: registro de herramientas presentables — agrupación, nombre y
  descripción en español, y qué puede seleccionar un usuario frente a qué puede
  declarar una fila del catálogo.

### Modified Capabilities

<!-- `openspec/specs/` sigue vacío. Las capacidades relacionadas
     (`unified-skills-model`, `passive-skills-persistence`) viven en cambios sin
     archivar; este cambio añade un eje de configuración, no altera sus
     requisitos. -->

## Impact

**Código**

- Nuevo `src/shared/skills/tool-registry.ts` (registro y agrupación) y
  `src/shared/skills/tool-selection.ts` (resolución pura).
- `src/shared/skills/surface-tools.ts`: se añade `USER_SELECTABLE_TOOLS` junto a
  la ya existente `NEVER_FROM_SKILLS`, que no cambia.
- `src/services/gemini-tools/turn-catalog.ts` y
  `src/services/gemini-chat/model-config.ts`: el catálogo del turno se filtra por
  la selección.
- `electron/skill-catalog/`, `electron/passive-skills/`: la selección viaja a los
  canales y a las rutinas.
- `src/components/skills-settings/`: selector por grupos.

**Datos**

- `user_skill_settings` sustituye a `user_skill_channels` (migración de filas).
- `passive_skills` gana `tools text[]` y `web_search text`.

**Riesgo principal**

Ampliar lo que el usuario puede seleccionar toca una frontera de privilegio. Se
acota con tres invariantes cubiertas por pruebas: la selección nunca amplía la
superficie, nunca salta la autorización del canal, y nunca retira una
confirmación.
