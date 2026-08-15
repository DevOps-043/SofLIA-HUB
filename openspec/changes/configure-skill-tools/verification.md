# Verificación — configure-skill-tools

Fecha: 2026-08-15.

## Compuertas ejecutadas

| Compuerta | Comando | Resultado |
|---|---|---|
| Tipos | `npx tsc --noEmit -p tsconfig.json` | ✅ Sin errores |
| Arnés | `npm run harness:validate` | ✅ |
| Pruebas de main | `npx vitest run electron` | ✅ 1330/1331 (1 fallo preexistente) |
| Pruebas del renderer (dirigidas) | 7 suites afectadas | ✅ 75/75 |

El fallo de main sigue siendo `WA-160`, preexistente y documentado.

## Pruebas nuevas

| Archivo | Cubre | Casos |
|---|---|---|
| `src/__tests__/shared/skill-tool-selection.test.ts` | Resolución, herencia, búsqueda web y las dos listas | 22 ✅ |
| `src/__tests__/shared/tool-registry-crossref.test.ts` | El registro contra el catálogo runtime real | 3 ✅ |
| `src/__tests__/services/skill-tool-filtering.test.ts` | El catálogo que se envía al modelo | 10 ✅ |

Las invariantes que fijan, que son la razón de que esto no sea una escalada de
privilegios:

- **Nunca amplía**: seleccionar `use_computer` cuando la superficie no lo ofrece
  deja el catálogo vacío, no lo añade.
- **La ausencia no retira**: sin selección, el catálogo es idéntico al de antes
  del cambio (comprobado comparando ambas listas completas).
- **No relaja las filas del catálogo**: `isToolAllowedFromSkill` sigue negando
  `gmail_send`, `use_computer`, `delete_item` y `drive_upload` en las tres
  superficies. Es la prueba que detectaría que este cambio tocó
  `NEVER_FROM_SKILLS` sin querer.
- **Lista vacía ≠ sin selección**: la primera retira todo, la segunda no retira
  nada.
- **El registro no miente**: la prueba cruzada verifica cada identificador contra
  las declaraciones reales. Es la única que caza una errata — un nombre mal
  escrito no falla en ningún otro sitio, simplemente se descarta al intersecar.

## Un hallazgo del desarrollo

El registro incluye seis herramientas (`gmail_trash` y los cinco `gchat_*`) que
**no existen en el catálogo del chat del Hub**, solo en el de los canales. Están
marcadas con `channelOnly` y la interfaz lo indica, en vez de ofrecerlas como si
estuvieran disponibles en todas partes. La prueba cruzada verifica las dos
direcciones: que ninguna sin marcar falte en el chat, y que ninguna marcada esté
en él (una marca de más diría una limitación falsa).

## Pendiente

1. **Ejecutar `user-skill-settings.sql`** en la instancia Pulse Hub. Copia las
   filas de `user_skill_channels` si existe, así que puede ejecutarse antes o
   después de la anterior sin perder configuración.
2. **Aplicar la selección en WhatsApp y Telegram al ejecutar** (tarea 4.4). El
   almacenamiento y la resolución ya son compartidos, pero el punto donde el
   agente de canal arma su catálogo todavía no consulta la selección: hoy acota
   en el chat del Hub y en las skills pasivas que pasan por él.
3. **Respetar `web_search` en `send-message-stream`** (tarea 4.3). El ajuste se
   guarda y se resuelve (`shouldSearchWeb`), pero el enrutado todavía usa solo la
   heurística.
4. **Selector en el editor de skill pasiva** (tarea 5.4), con la opción de
   heredar.
5. Comprobar en vivo que acotar una skill reduce el catálogo enviado.
