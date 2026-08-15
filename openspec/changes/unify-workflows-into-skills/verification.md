# Verificación — unify-workflows-into-skills

Fecha: 2026-08-14. Rama: `main`.

## Compuertas ejecutadas

| Compuerta | Comando | Resultado |
|---|---|---|
| Tipos | `npx tsc --noEmit -p tsconfig.json` | ✅ Sin errores |
| Arnés | `npm run harness:validate` | ✅ 25 rutas y 9 skills canónicas |
| Semilla del catálogo | `node scripts/quality/system-skills-seed.mjs` | ✅ La semilla coincide con el registro en código |
| Pruebas de main | `npx vitest run electron` | ⚠️ 1307 pasan, 1 falla **preexistente** (ver abajo) |
| Pruebas del renderer (dirigidas) | `npx vitest run` sobre las 10 suites afectadas | ✅ 75/75 |
| Pruebas del renderer (completas) | `npx vitest run src` | ⚠️ **Se cuelga**, también en árbol limpio (ver abajo) |

## Fallos preexistentes, ajenos a este cambio

`electron/__tests__/whatsapp-workflow-presentacion.test.ts > WA-160` falla
esperando que el workspace reciba `index.html`. El runtime de presentaciones
produce `deck.json` desde el cambio `add-skills-and-html-presentations`, de modo
que la aserción quedó desactualizada respecto al contrato vigente.

**Comprobado que no lo causa este cambio**: se ejecutó la prueba con los cambios
guardados en `git stash` (árbol limpio) y falla igual. No se corrige aquí para no
mezclar un arreglo ajeno con esta entrega.

### La suite completa del renderer se cuelga

`npx vitest run src` deja de avanzar siempre en el mismo punto (448 líneas de
log) y nunca termina. **Comprobado en árbol limpio**: con los cambios en
`git stash`, se cuelga exactamente en el mismo punto y con el mismo número de
líneas, así que es anterior a esta entrega.

Las suites implicadas pasan **en aislamiento**
(`chat-selection-attachment`, `web-grounding-routing`, `orb-speech-text`,
`skills-turn-catalog`), de modo que apunta a un recurso sin liberar al ejecutar
el conjunto, no a un test roto. Queda como deuda a diagnosticar aparte.

### `PresentationPlayerApp` es inestable (flaky)

`src/__tests__/presentation-runtime/PresentationPlayerApp.test.tsx > renderiza
una grafica con semantica accesible` falla de forma intermitente: en tres
ejecuciones seguidas del mismo código pasó 2 y falló 1. Espera con
`findByLabelText` una gráfica que aparece tras cambiar de diapositiva, así que
depende de un tiempo de render.

**No lo causa este cambio**: el commit no toca ningún archivo del reproductor de
presentaciones (comprobado con `git show --name-only`). Lo único que este cambio
hace sobre esa Skill es añadir `telegram` a sus superficies.

Por eso las pruebas del renderer se ejecutaron **dirigidas** a las 10 suites que
este cambio toca, con 75/75 en verde:

`src/__tests__/shared/skill-channels.test.ts`, `SkillsSettingsPanel`,
`SkillLibrary`, `WhatsAppPassiveSkillsCard`, `orb-conversation`, `OrbInfoPanel`,
`OrbTranscriptPanel`, `orb-speech-text` y `skill-slash-commands`.

## Pruebas nuevas

| Archivo | Cubre | Casos |
|---|---|---|
| `src/__tests__/shared/skill-channels.test.ts` | Modelo puro de canales y allowlist de herramientas | 13 ✅ |
| `electron/__tests__/passive-skills.test.ts` | Normalización de tareas antiguas, entrega por canal, reglas del sistema | 12 ✅ |
| `electron/__tests__/orb-announcements.test.ts` | Cola de anuncios, guarda de sesión, relevo y acuse | 6 ✅ |
| `src/__tests__/components/orb-conversation.test.tsx` (ampliada) | Anuncio proactivo en el renderer: ORB-ANUNCIO-1 y 2 | 2 ✅ |

Casos destacados por lo que protegen:

- **La elección del usuario nunca amplía el catálogo.** Pedir Telegram para una
  Skill que no lo declara no la hace disponible allí.
- **La ausencia de elección no retira nada.** Sin fila, y ante un fallo de
  lectura, la Skill queda activa en todos los canales de su catálogo.
- **Ninguna fila del catálogo se concede escritura.** Se fija por prueba que
  `gmail_send`, control del equipo, papelera, etiquetas, planes de organización,
  subida a Drive y alta/baja de eventos se descartan en las tres superficies.
- **Un canal caído no arrastra a los demás.** Y un canal que lanza tampoco.
- **La orbe no habla sin sesión**, y dos anuncios del mismo minuto se serializan.
- **El ejecutor devuelve el texto en vez de enviarlo**, que es lo que impedía
  que una regla de solo-orbe llegara igualmente al teléfono.

## Pruebas migradas

- `electron/__tests__/whatsapp-agent/passive-skill-tests.ts` (antes
  `passive-workflow-tests.ts`): adaptada al nuevo contrato, y se le añadió el
  caso de canal explícito.
- `electron/__tests__/preload/channel-cases.ts` y `source-verification-cases.ts`:
  exigían al menos 6 canales `workflow-hub:*`. Ahora exigen 3 canales
  `passive-skills:*` **y** que no quede ningún `workflow-hub:*`, para que un
  handler resucitado sin panel que lo consuma se detecte.

## Pruebas eliminadas

Las del motor retirado: `electron/__tests__/workflow-hub/**`,
`workflow-hub-service.test.ts`, `workflow-hub-test-mocks.ts`,
`workflow-hub-test-service.ts`, `workflow-hub-automation-fixtures.ts` y
`workflow-hub-meeting-fixtures.ts`. La cobertura de reuniones no se pierde:
vive en las suites de `electron/meetings/**`, que nunca dependieron del Hub
(comprobado antes de borrar).

## Pendiente de verificación manual

Estas rutas cruzan procesos y no se pueden cubrir con las suites actuales:

1. **Migraciones en Supabase Hub**: ejecutar `system-skills-flujos.sql` y
   `user-skill-channels.sql`, y comprobar sus bloques de verificación. Sin la
   primera, las seis Skills no aparecen (no tienen respaldo en código, por
   diseño).
2. **El `UPDATE` de Presentaciones a Telegram**: la fila ya existe en
   producción y `ON CONFLICT DO NOTHING` no la pisaría; sin ese `UPDATE`, una
   fila que no nombra `telegram` retira la Skill de esa superficie aunque el
   código la declare.
3. **Anuncio proactivo E2E**: programar una Skill pasiva con canal Computadora y
   comprobar que la orbe aparece sin robar el foco, locuta y se puede silenciar.
4. **Telegram E2E**: vincular un chat, pedir `/skills` y una presentación.
5. **Continuidad**: actualizar sobre una instalación con workflows pasivos ya
   programados y comprobar que siguen ejecutándose y entregando.
