## Context

Ver `proposal.md` — Why. Lo que condiciona el enfoque:

- El catálogo del turno se arma en `buildModelTools` a partir de grupos enteros
  (`COMPUTER_USE_TOOLS`, `GOOGLE_WORKSPACE_TOOLS`, …), no herramienta a
  herramienta. Filtrar exige descender al nivel de `functionDeclarations`.
- `surface-tools.ts` ya tiene `NEVER_FROM_SKILLS` y `ALLOWED_BY_SURFACE`, pero
  ambas responden a la pregunta *"¿qué puede declarar una FILA?"*. La pregunta
  nueva es distinta y necesita su propia lista.
- **La búsqueda web no es una herramienta.** En Gemini es grounding de Google
  Search y la API **no permite** mezclarlo con function calling en una misma
  petición; existe una fase de "investigación + acción" precisamente porque una
  petición mixta hacía que el modelo alucinara haber creado un archivo. Hoy se
  decide con `shouldUseWebGrounding(message)`, una heurística sobre el texto.
- En los modelos OpenAI el bucle sí conserva `web_search` como herramienta.
- Las herramientas de canal (WhatsApp/Telegram) pasan además por
  `communicationHubService.authorizeTool`, que es una guarda independiente.

## Goals / Non-Goals

**Goals**

- Que el usuario acote qué toca cada Skill, y muy especialmente cada rutina que
  corre sin nadie delante.
- Que acotar reduzca de verdad el catálogo que se envía al modelo.
- Que la elección no pueda convertirse en una escalada de privilegios.

**Non-Goals**

- Editar las herramientas de las Skills del sistema *para todos los usuarios*:
  la selección es de cada usuario.
- Reescribir el enrutado de grounding: se le añade un override, no se sustituye.

## Decisions

### D1. Dos listas: lo que declara una fila y lo que selecciona un usuario

**Decisión**: `NEVER_FROM_SKILLS` se queda **igual**. Se añade
`USER_SELECTABLE_TOOLS`, que sí incluye correo, calendario, Drive, navegador y
control de la computadora.

**Por qué**: en el cambio anterior el actor era una fila de `system_skills`,
escrita por un operador y potencialmente influida por una fuente externa; por eso
se le negó todo lo que actúa hacia fuera. Aquí el actor es el dueño de la Skill,
en su configuración, con su sesión y sobre su propio equipo. Tratar los dos casos
con la misma lista obligaría a elegir entre dejar indefensa la fila o dejar
inútil la configuración del usuario.

**Lo que sigue fuera de ambas**: `whatsapp_send_file` y las herramientas de nodos
remotos. No son una decisión "por Skill" sino de la superficie y del inventario
de nodos; ofrecerlas aquí sugeriría un control que esta pantalla no tiene.

### D2. La selección es una intersección, y su ausencia no retira nada

**Decisión**: catálogo efectivo = (lo que ofrece la superficie) ∩ (lo que
autoriza el canal) ∩ (lo que el usuario seleccionó, si seleccionó algo).

**Por qué la ausencia no retira**: es la misma asimetría que ya rige los canales
y el catálogo del sistema. Una Skill sin configurar debe seguir funcionando
exactamente igual que antes de esta versión; que aparezca una pantalla nueva no
puede apagar capacidades a nadie.

**Consecuencia**: seleccionar es siempre **restringir**. No existe forma de que
una selección conceda algo que la superficie no tenía, y eso es lo que la hace
segura.

### D3. La búsqueda web es un eje aparte, con tres estados

**Decisión**: `webSearch: 'auto' | 'siempre' | 'nunca'`, fuera de la lista de
herramientas.

**Por qué no una herramienta más**: sería mentir sobre el modelo de ejecución.
Con Gemini, activar grounding **excluye** las function declarations de esa
petición; presentarla como una casilla junto a las demás haría creer que se
combinan, y el usuario no entendería por qué al marcarla dejan de funcionar las
otras. Como eje propio se puede explicar y se puede resolver: `siempre` fuerza la
ruta de grounding y, si el encargo además exige acción local, se encadena la fase
de acción que ya existe.

**`nunca`**: útil para rutinas deterministas —un triage de correo no debe irse a
internet porque el asunto diga "noticias"—.

### D4. `user_skill_channels` se consolida en `user_skill_settings`

**Decisión**: una sola tabla con `(user_id, skill_id)` que guarda `channels`,
`tools` y `web_search`.

**Por qué**: la clave es idéntica y el ciclo de vida también; dos tablas con la
misma clave se consultarían siempre juntas y se desincronizarían al borrar. La
migración copia las filas existentes, de modo que quien ya hubiera configurado
canales no pierde nada.

**Riesgo asumido**: es un renombrado de una tabla introducida en el cambio
anterior. Se acepta porque todavía no está desplegada en producción y el coste de
arrastrar dos tablas es permanente.

### D5. El filtrado ocurre al construir el catálogo, no al ejecutar

**Decisión**: `buildModelTools` filtra las `functionDeclarations` de cada grupo
por la selección resuelta; el ejecutor no cambia.

**Por qué**: si se filtrara al ejecutar, el modelo seguiría viendo las
herramientas y las llamaría, y el usuario recibiría rechazos en lugar de una
respuesta útil. Además no se ahorraría ni un token. Filtrar antes es lo que
mejora fiabilidad y coste, que son dos de los tres motivos del cambio.

**Guarda que NO se mueve**: las confirmaciones siguen en el ejecutor. Que una
herramienta esté en el catálogo no dice nada sobre si su uso concreto necesita
aprobación.

## Risks / Trade-offs

- **[Ampliar lo seleccionable es una frontera de privilegio]** → La selección
  solo interseca (D2); tres pruebas fijan que no amplía superficie, no salta la
  autorización del canal y no retira confirmaciones.
- **[El usuario se acota de más y la Skill deja de funcionar]** → La interfaz
  agrupa por dominio y marca las herramientas cuyo efecto no se deshace; la
  ausencia de selección conserva todo.
- **[`web_search: siempre` en una rutina programada gasta cuota]** → Es explícito
  y por Skill; el valor por omisión sigue siendo la heurística.
- **[Renombrar la tabla de canales]** → Migración que copia filas, idempotente,
  con ROLLBACK.
