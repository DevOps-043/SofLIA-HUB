## 1. Registro de herramientas

- [x] 1.1 Crear `src/shared/skills/tool-registry.ts`: grupos de dominio (Correo, Calendario, Drive, Chat, Navegador, Computadora, Archivos, Procesos, Proyectos, Imágenes, Espacio de trabajo) con nombre y descripción en español por herramienta.
- [x] 1.2 Marcar las herramientas cuyo efecto no se deshace desde el chat (`irreversible: true`) para que la interfaz lo señale.
- [x] 1.3 Añadir `USER_SELECTABLE_TOOLS` a `src/shared/skills/surface-tools.ts`, sin tocar `NEVER_FROM_SKILLS` (ver `design.md` — D1).
- [x] 1.4 Dejar fuera de lo seleccionable `whatsapp_send_file` y las herramientas de nodos remotos.
- [x] 1.5 Pruebas: toda entrada del registro existe en el catálogo runtime; toda herramienta seleccionable está en el registro; ninguna entrada del registro está en `NEVER_FROM_SKILLS` sin estar marcada como no declarable por fila.

## 2. Resolución de la selección

- [x] 2.1 Crear `src/shared/skills/tool-selection.ts` (módulo puro) con `resolveSkillTools({ surfaceTools, userSelection, surface })`: intersección, y ausencia de selección = todo lo de la superficie.
- [x] 2.2 Descartar identificadores desconocidos y no seleccionables sin romper el resto.
- [x] 2.3 Añadir el tipo `SkillWebSearch = 'auto' | 'siempre' | 'nunca'` y su resolución.
- [x] 2.4 Pruebas: acota; sin selección no retira; no amplía; descarta desconocidos.

## 3. Almacenamiento

- [x] 3.1 Escribir `database/lia/migrations/user-skill-settings.sql`: tabla `user_skill_settings` con `(user_id, skill_id)`, `channels`, `tools`, `web_search`, RLS por `auth.uid()`.
- [x] 3.2 Copiar las filas de `user_skill_channels` si la tabla existe; idempotente y con ROLLBACK.
- [x] 3.3 Añadir `tools text[]` y `web_search text` a `passive_skills`.
- [x] 3.4 Actualizar `database/lia/snapshots/schema.sql`.
- [x] 3.5 Actualizar los stores del renderer y de main para leer y escribir la tabla nueva.

## 4. Aplicación en el turno

- [x] 4.1 Ampliar `ActiveSkillContext` con `allowedTools` y `webSearch`.
- [x] 4.2 Filtrar las `functionDeclarations` de cada grupo en `buildModelTools` (ver `design.md` — D5).
- [ ] 4.3 Respetar `webSearch` en `send-message-stream`, encadenando la fase de acción cuando el encargo además exija acción local. (Pendiente: el ajuste se guarda y se resuelve, pero el enrutado sigue usando solo la heurística.)
- [ ] 4.4 Aplicar la selección en WhatsApp y Telegram al resolver la Skill. (Pendiente: el almacenamiento y la resolución ya son compartidos; falta el punto donde el agente de canal arma su catálogo.)
- [ ] 4.5 Aplicar la selección de la Skill pasiva al ejecutar una rutina, heredando la de su Skill si no declara. (Pendiente: depende de 4.4.)
- [x] 4.6 Pruebas: el catálogo enviado al modelo se reduce; el canal sigue rechazando lo no autorizado; las confirmaciones se conservan.

## 5. Interfaz

- [x] 5.1 Selector de herramientas por grupo en la configuración de cada Skill, con activar/desactivar grupo completo.
- [x] 5.2 Señalar las herramientas irreversibles y explicar que seleccionar no elimina las confirmaciones.
- [x] 5.3 Selector de búsqueda web con sus tres estados y una línea que explique por qué no es una herramienta más.
- [ ] 5.4 Selector en el editor de Skill pasiva, con la opción de heredar. (Pendiente.)
- [ ] 5.5 Pruebas de renderer: sin selección no se envía nada; desmarcar un grupo lo retira; heredar no escribe selección propia. (Parcial: cubierto en el módulo puro y en el filtrado del turno; falta la prueba de interacción del selector.)

## 6. Documentación y verificación

- [x] 6.1 Documentar el eje de selección y las dos listas en `docs/architecture/runtime-agents-manual.md`.
- [x] 6.2 Añadir a `docs/security/security-and-privacy.md` las tres invariantes de la selección.
- [x] 6.3 Actualizar `docs/data/data-dictionary.md` con `user_skill_settings`.
- [x] 6.4 Entrada en `CHANGELOG.md`.
- [x] 6.5 Ejecutar typecheck, pruebas y `harness:validate`; evidencia en `verification.md`.
