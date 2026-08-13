## Context

Ver `proposal.md` — Why. Lo que condiciona el diseño es el estado actual:

- Las Skills del sistema se declaran en `src/shared/skills/registry.ts`, un
  módulo **compartido** por renderer y main: `electron/wa-agent/chat-commands/skills.ts`
  importa desde `src/shared/`. Cualquier resolución nueva puede vivir en el
  mismo sitio y servir a las dos superficies.
- Las Skills del usuario ya se leen desde `public.skills` en la instancia Pulse
  Hub (`VITE_SUPABASE_URL`) con RLS por `auth.uid()`. El renderer tiene sesión
  Supabase; main tiene su propio cliente en `electron/hub-db-client.ts`. **No
  hace falta un canal IPC nuevo**: cada superficie lee con el cliente que ya
  tiene.
- La guarda de herramientas ya existe: `filterSkillTools` (`src/shared/skills/surface-tools.ts`)
  aplica una allowlist por superficie y una lista de herramientas que ninguna
  Skill puede aportar (`use_computer`, `execute_command`, `delete_item`…). El
  catálogo del turno la invoca en `turn-catalog.ts`. Mover la declaración a la
  base de datos **no la esquiva**, siempre que la Skill remota atraviese el mismo
  camino.
- No existe guarda equivalente para la política de espacio de trabajo: hoy es un
  objeto congelado en código y nadie lo valida, porque nadie podía escribirlo.

## Goals / Non-Goals

**Goals:**

- Que el catálogo del sistema se administre en la base de datos y llegue a todos
  los usuarios autenticados sin publicar versión.
- Que una fila no pueda ampliar por su cuenta lo que la aplicación hace en el
  equipo: herramientas filtradas por la allowlist existente y política de espacio
  de trabajo acotada al leerla.
- Que un fallo de red, una tabla vacía o una consulta rechazada no dejen al
  usuario sin Skills.
- Que la forma resultante sirva de base al marketplace sin rediseñarla.

**Non-Goals:**

- Persistir el catálogo remoto entre sesiones. La caché es de sesión; el respaldo
  entre arranques es la versión instalada.
- Interfaz de administración del catálogo dentro del producto.
- Firma criptográfica de las filas. Se apunta como evolución para cuando el
  catálogo admita autores externos.

## Decisions

### D1. Tabla `public.system_skills` en la instancia Pulse Hub

Misma instancia que `public.skills` para que una sola sesión resuelva el catálogo
completo. Clave primaria `text` con el identificador estable ya en uso
(`sistema:presentaciones`), no `uuid`: el identificador es el contrato entre la
fila, el código y la telemetría, y ya existe.

```
public.system_skills
  id                text PRIMARY KEY  CHECK (id LIKE 'sistema:%')
  name              text NOT NULL
  description       text
  icon              text NOT NULL DEFAULT 'herramienta'
  command           text
  category          text
  surfaces          text[] NOT NULL          -- {'chat','whatsapp'}
  sort_order        integer NOT NULL DEFAULT 100
  enabled           boolean NOT NULL DEFAULT true
  blocked_in_groups boolean NOT NULL DEFAULT false
  starter_prompts   jsonb NOT NULL DEFAULT '[]'
  instructions      text NOT NULL
  tools             jsonb NOT NULL DEFAULT '[]'   -- nombres; se filtran al leer
  workspace         jsonb                          -- política; se acota al leer
  min_app_version   text                           -- una versión anterior la ignora
  created_at        timestamptz NOT NULL DEFAULT now()
  updated_at        timestamptz NOT NULL DEFAULT now()
```

`min_app_version` es barato ahora y evita el problema que traerá el marketplace:
una fila que necesita capacidades de una versión nueva no puede romper a quien
todavía no la tiene.

**Alternativa descartada:** reutilizar `public.skills` con una columna
`is_system`. La propia migración de esa tabla lo rechaza por escrito —«la
frontera de privilegio no puede vivir en un booleano escribible»— y aquí el
argumento sigue en pie: el aislamiento de las Skills del usuario es RLS por
`auth.uid()`, y una fila del sistema no tiene dueño.

### D2. Lectura para `authenticated`, escritura solo `service_role`

RLS activo con **una sola** política, de `SELECT` para `authenticated` con
`USING (true)`. No se declara ninguna política de `INSERT`, `UPDATE` ni `DELETE`:
sin política, RLS las deniega, y `service_role` la esquiva por definición. Es la
guarda de la que dependen todas las demás — si un usuario autenticado pudiera
escribir el catálogo global, una sola cuenta comprometida alcanzaría todos los
escritorios.

### D3. El acotado vive en `shared`, no en cada superficie

Un módulo puro nuevo en `src/shared/skills/` convierte fila → `SystemSkill`
aplicando:

1. **Herramientas**: se reutiliza `filterSkillTools(surface, tools)`, ya existente.
   No se añade una segunda lista: duplicarla garantizaría que divergieran.
2. **Espacio de trabajo**: `rootFolder` saneado (sin raíz absoluta, sin `..`, un
   solo segmento), `allowedExtensions` intersecado con las que el producto admite,
   `maxFileBytes` y `maxWorkspaceBytes` topados, `protectedFiles` normalizados.
   Los archivos del sistema (`estilos/marca.css`, `estilos/base.css`,
   `guion-base.js`) se añaden siempre a `protectedFiles`, los declare la fila o no.
3. **Descartes visibles**: cada recorte deja traza, y la Skill se ofrece igual.
   Un catálogo mal escrito degrada, no rompe.

Al ser puro, se prueba sin base de datos y lo usan idénticamente renderer y main.

**Alternativa descartada:** validar en la base de datos con `CHECK` y disparadores.
No alcanza: la lista de herramientas concedibles y el máximo de bytes son
propiedades de la versión instalada, no del esquema, y cambian con el producto.

### D4. Fusión por identificador, con la versión instalada como respaldo

| Estado de la fila | Resultado |
|---|---|
| Existe y `enabled` | Manda la fila (ya acotada) |
| Existe y `not enabled` | La Skill se retira, aunque el código la declare |
| Existe con `min_app_version` mayor | Se ignora la fila; manda el código si lo hay |
| No existe, el código sí | Manda el código (respaldo) |
| Existe y el código no | Se ofrece la fila acotada — es el camino del marketplace |
| La consulta falla | Manda el código entero |

La asimetría entre «no existe» y «deshabilitada» es deliberada: es lo que impide
repetir el fallo de la bandera, donde una variable ausente equivalía a apagado.
Retirar una Skill pasa a ser un acto declarado.

### D5. Sin canal IPC nuevo

El renderer lee con `src/lib/supabase`; main con `electron/hub-db-client.ts`.
Añadir un canal solo para que main pidiera al renderer lo que puede consultar
directamente acoplaría el agente de WhatsApp a que haya una ventana abierta.

### D6. Caché de sesión

Cada superficie cachea el resultado en memoria durante la sesión y lo refresca
cuando ya se resuelve el catálogo (montaje del chat, arranque del agente de
WhatsApp). No se persiste a disco: el respaldo entre arranques es la versión
instalada, y persistirlo añadiría un tercer origen de verdad que habría que
invalidar.

## Risks / Trade-offs

- **La fila y el código se separan** (el prompt se edita en base de datos y el
  respaldo queda viejo) → la semilla se genera desde el registro en código y un
  script de calidad compara ambas, de modo que la divergencia sea visible en el
  PR y no una sorpresa cuando falle la red.
- **Un `enabled = false` equivocado retira la Skill para todos** → es escritura de
  `service_role`, fuera de la aplicación; se documenta con el mismo cuidado que
  una release y el rollback es una sola sentencia.
- **Instrucciones manipuladas dirigen las herramientas ya concedidas** → es el
  coste aceptado de tener las instrucciones en base de datos. Se acota con la
  allowlist de herramientas y con el espacio de trabajo topado: un prompt no
  amplía el conjunto, solo lo usa. La escritura restringida es la defensa real.
- **Una fila válida para una versión futura llega a una antigua** →
  `min_app_version` y el descarte silencioso de campos desconocidos.
- **Latencia añadida al abrir la biblioteca** → una consulta por sesión, con
  caché en memoria y respaldo inmediato mientras resuelve; la interfaz nunca
  espera al catálogo remoto para ofrecer las Skills de la versión.

## Migration Plan

1. Aplicar la migración en la instancia Pulse Hub: tabla, RLS y semilla de
   Presentaciones con los valores exactos del registro en código.
2. Verificar en la propia migración: la política de `SELECT` existe, no hay
   políticas de escritura, y la semilla coincide con el código.
3. Publicar la versión con el lector. Antes de aplicar la migración se comporta
   igual que hoy (respaldo); después toma el catálogo remoto.
4. `VITE_SKILL_PRESENTACIONES_ENABLED` se conserva un ciclo como apagado local de
   emergencia y se retira en el cambio siguiente.

**Rollback:** `DROP TABLE public.system_skills`. El lector cae al respaldo en
código y el producto vuelve exactamente al comportamiento anterior sin publicar
versión. No hay datos de usuario en la tabla, así que no hay pérdida.

## Open Questions

- Si el marketplace acabará necesitando permisos por organización o por usuario.
  No cambia este diseño: sería una tabla de habilitaciones que filtra el mismo
  catálogo, y el alcance global de hoy equivale a «todos habilitados».
- Si las filas de autores externos exigirán firma. Solo aplica cuando el catálogo
  deje de escribirse únicamente con `service_role`.
