## 1. Acotado compartido (sin base de datos todavía)

- [x] 1.1 Añadir a `src/shared/skills/types.ts` el tipo de la fila remota (`SystemSkillRow`) con todos los campos del catálogo, incluidos `tools`, `workspace`, `enabled`, `surfaces`, `sortOrder` y `minAppVersion`.
- [x] 1.2 Crear `src/shared/skills/system-catalog.ts` (módulo puro) con `clampWorkspacePolicy`: raíz de un solo segmento sin `..` ni ruta absoluta, extensiones intersecadas con las admitidas, `maxFileBytes` y `maxWorkspaceBytes` topados al máximo del producto, y los archivos del sistema siempre en `protectedFiles`.
- [x] 1.3 Añadir en el mismo módulo `toSystemSkill(row, surface)`: valida campos obligatorios, normaliza el comando con `toSkillCommand`, filtra herramientas con `filterSkillTools` y aplica `clampWorkspacePolicy`. Una fila inválida devuelve `null` con traza; nunca lanza.
- [x] 1.4 Añadir `mergeSystemSkills(codeSkills, rows, surface, appVersion)` con la tabla de fusión de `design.md` — D4: la fila manda, `enabled: false` retira, ausencia respeta el código, `minAppVersion` mayor ignora la fila.
- [x] 1.5 Pruebas del módulo puro: acotado de raíz, extensiones y bytes; descarte de `use_computer` y `execute_command` declarados por una fila; cada rama de la tabla de fusión; fila con campos desconocidos; fila con `instructions` vacías.

## 2. Migración de la base de datos

- [x] 2.1 Escribir `database/lia/migrations/system-skills-catalog.sql` con la tabla de `design.md` — D1, idempotente (`IF NOT EXISTS`, `ON CONFLICT`) y con bloque de ROLLBACK.
- [x] 2.2 Declarar RLS: `ENABLE ROW LEVEL SECURITY` y **una sola** política de `SELECT` para `authenticated` con `USING (true)`. No declarar políticas de escritura.
- [x] 2.3 Sembrar la fila de `sistema:presentaciones` con los valores exactos del registro en código (nombre, descripción, ícono, comando `presentacion`, categoría, superficies, `blocked_in_groups`, prompts de inicio, instrucciones, herramientas y política de workspace).
- [x] 2.4 Añadir el bloque de verificación al final de la migración: la política de `SELECT` existe, no hay políticas de escritura, y la semilla devuelve una fila habilitada.
- [x] 2.5 Añadir `database/lia/snapshots/schema.sql` la tabla nueva, siguiendo el formato del snapshot existente.

## 3. Lectura desde el renderer

- [x] 3.1 Crear `src/services/skills/system-skills-store.ts`: consulta `public.system_skills` con el cliente Supabase del Hub, mapea con el módulo puro y cachea el resultado en memoria durante la sesión.
- [x] 3.2 Un fallo de consulta (red, permisos, tiempo de espera) devuelve `null` con traza, nunca lanza ni propaga error a la interfaz.
- [x] 3.3 Cablear `src/services/skills/catalog.ts` para fusionar el catálogo remoto con `systemSkillsForSurface` en vez de usar solo el registro en código.
- [x] 3.4 Pruebas: el catálogo se resuelve desde filas; un fallo de consulta conserva las Skills de la versión; una fila deshabilitada las retira; una fila sin contraparte en código se ofrece acotada.

## 4. Lectura desde main (WhatsApp)

- [x] 4.1 Crear `electron/skill-catalog/system-skills-store.ts` usando `electron/hub-db-client.ts`, con el mismo módulo puro y la misma caché de sesión.
- [x] 4.2 Cablear `electron/wa-agent/chat-commands/skills.ts` para resolver contra el catálogo fusionado, conservando el bloqueo en grupos y el filtro por superficie.
- [x] 4.3 Pruebas: paridad chat/WhatsApp sobre la misma fila; una Skill sin la superficie `whatsapp` no se ofrece ni se puede invocar; sin cliente Supabase configurado se resuelve el respaldo en código.

## 5. Guardas de identidad

- [x] 5.1 Confirmar con prueba que una fila de `public.skills` (Skill de usuario) que reclame un identificador `sistema:` se descarta del catálogo del usuario.
- [x] 5.2 Confirmar con prueba que un comando en conflicto entre una Skill de usuario y una del sistema resuelve a la del sistema.

## 6. Coherencia entre la semilla y el código

- [x] 6.1 Añadir `scripts/quality/check-system-skills-seed.mjs`: compara los valores de la semilla de la migración con el registro en código y falla si divergen.
- [x] 6.2 Enganchar el script en `npm run verify:pr`.

## 7. Documentación

- [x] 7.1 Actualizar `docs/architecture/runtime-agents-manual.md`: el catálogo del sistema se resuelve desde la base de datos con respaldo en la versión instalada, y el acotado de herramientas y workspace.
- [x] 7.2 Actualizar `docs/operations/configuration.md`: `VITE_SKILL_PRESENTACIONES_ENABLED` pasa a apagado local de emergencia; la disponibilidad la manda la fila.
- [x] 7.3 Registrar la tabla y su modelo de permisos en `docs/standards/database.md`.
- [x] 7.4 Escribir `verification.md` del cambio con la evidencia: salida de la migración, pruebas ejecutadas y prueba manual del catálogo con la base de datos caída.

## 8. Verificación de extremo a extremo

- [ ] 8.1 Ejecutar la migración en la instancia Pulse Hub y guardar la salida del bloque de verificación.
- [ ] 8.2 Comprobar a mano con una sesión de usuario que `INSERT`, `UPDATE` y `DELETE` sobre `public.system_skills` son rechazados.
- [ ] 8.3 Comprobar a mano: `/presentacion` y `/presentaciones` ofrecen la Skill; deshabilitar la fila la retira de las dos superficies; volver a habilitarla la restituye.
- [ ] 8.4 Comprobar a mano con la red cortada que el chat sigue ofreciendo la Skill de la versión instalada.
- [ ] 8.5 Ejecutar `npm run typecheck`, `npm run test` y `npm run verify:pr`.
