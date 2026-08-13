## Why

Las Skills del sistema se declaran hoy solo en código, así que su catálogo no se
puede gestionar sin publicar una versión: cambiar un nombre, una descripción, un
prompt o retirar una Skill exige un instalador nuevo para cada usuario. Ese
acoplamiento ya produjo un fallo real en producción: la versión 0.9.6 se publicó
sin la Skill de Presentaciones —ni comando, ni biblioteca, para todos sus
usuarios— porque el `.env` del runner se generó sin
`VITE_SKILL_PRESENTACIONES_ENABLED` y el build terminó en verde.

Además es la base del marketplace de Skills previsto: sin un catálogo en base de
datos no hay nada que publicar, listar ni versionar.

## What Changes

- Nueva tabla global de Skills del sistema en la instancia Pulse Hub
  (`VITE_SUPABASE_URL`, misma que `public.skills`). **Lectura para cualquier
  usuario autenticado; escritura solo con `service_role`.** Ningún usuario final
  puede insertar ni modificar filas.
- La fila define la Skill **completa**: identificador, nombre, descripción,
  ícono, comando, categoría, superficies, orden, estado, prompts de inicio,
  **instrucciones, herramientas y política de espacio de trabajo**.
- **BREAKING** — La frontera de privilegio deja de ser "una fila nunca declara
  herramientas". Pasa a ser un acotado en el lector: el sistema concede
  únicamente las herramientas que existen en el catálogo runtime local **y**
  están marcadas como concedibles a Skills, y acota la política de espacio de
  trabajo (raíz saneada, extensiones intersecadas con las permitidas, límites de
  bytes topados al máximo del producto). Una fila que pida más recibe menos, sin
  fallar.
- El registro en código (`src/shared/skills/registry.ts`) se conserva como
  **respaldo**: si la tabla está vacía, la consulta falla o no hay red, el
  usuario conserva las Skills del sistema que trae su versión. La ausencia de
  filas nunca retira una capacidad.
- Misma resolución en las dos superficies: el chat del Hub (renderer) y WhatsApp
  (main) leen el mismo catálogo con las mismas guardas, en vez de compartir solo
  el arreglo en código.
- Los identificadores del sistema siguen siendo un espacio reservado: una fila de
  `public.skills` (Skills del usuario) nunca puede presentarse como Skill del
  sistema, aunque reclame su identificador.

### No objetivos

- El marketplace en sí: publicación por terceros, instalación por usuario,
  versionado y monetización quedan fuera. Este cambio deja el catálogo sobre el
  que se construyen.
- Activación por organización o por usuario: el alcance es global, todas las
  Skills del sistema para todos los usuarios autenticados.
- Edición del catálogo desde la interfaz del producto: se administra con
  `service_role` fuera de la aplicación.
- Migrar las Skills del usuario: `public.skills` no cambia.

## Capabilities

### New Capabilities

- `system-skills-catalog`: resolución del catálogo de Skills del sistema desde la
  base de datos con respaldo en código, acotado de las capacidades que declara
  cada fila (herramientas y espacio de trabajo) y disponibilidad para todos los
  usuarios autenticados en chat y WhatsApp.

### Modified Capabilities

<!-- Ninguna: openspec/specs/ no contiene todavía especificaciones principales;
     `skills-registry` vive en el cambio `add-skills-and-html-presentations`, sin
     archivar. Las reglas que este cambio reemplaza se declaran completas en la
     capacidad nueva. -->

## Impact

- **Datos**: nueva tabla y sus políticas RLS en `database/lia/migrations/`, más
  la fila semilla de Presentaciones. `public.skills` no se toca.
- **Renderer**: `src/shared/skills/registry.ts`, `src/shared/skills/types.ts`,
  `src/services/skills/catalog.ts`, `src/services/skills/skill-flags.ts` y el
  nuevo lector del catálogo remoto.
- **Main**: `electron/wa-agent/chat-commands/skills.ts` y el cliente Supabase de
  main (`electron/hub-db-client.ts`), que hoy resuelve el catálogo de WhatsApp
  desde el registro en código.
- **Permisos**: la concesión de herramientas a una Skill pasa a depender de una
  marca explícita en el catálogo runtime; las herramientas del desktop-agent y de
  shell quedan fuera del alcance de cualquier fila.
- **Configuración**: `VITE_SKILL_PRESENTACIONES_ENABLED` deja de ser el
  interruptor de la Skill; su estado pasa a la fila. La variable se conserva un
  ciclo como apagado de emergencia local.
- **Documentación**: `docs/operations/configuration.md`,
  `docs/architecture/runtime-agents-manual.md`, `docs/standards/database.md` y el
  catálogo IPC si el lector de main requiere canal propio.
