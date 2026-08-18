## 1. Base de datos

- [ ] 1.1 Escribir `database/lia/migrations/agent-memory-tables.sql` con
      `agent_memory_messages`, `agent_memory_summaries`, `agent_memory_facts`,
      `agent_memory_skills` y `agent_memory_chunks`: `user_id` con llave foránea a
      `auth.users`, `uuid` de convergencia, columnas equivalentes a las de SQLite
      y `updated_at`.
- [ ] 1.2 Declarar los índices de consulta (por `user_id`, por sesión y por
      periodo) y la clave única de convergencia de skills
      (`user_id, skill_type, title`).
- [ ] 1.3 Declarar RLS: una política por tabla sobre `auth.uid() = user_id` para
      SELECT, INSERT, UPDATE y DELETE; ninguna política para `anon`.
- [ ] 1.4 Agregar el bloque `ROLLBACK` comentado al final del archivo y verificar
      que la migración es idempotente (`IF NOT EXISTS`).
- [ ] 1.5 Actualizar `database/lia/snapshots/schema.sql` y `database/README.md`.

## 2. Alcance y contrato local

- [ ] 2.1 Añadir a `electron/memory/scope.ts` la resolución de "owner
      sincronizable": solo `user:<id>` produce `user_id`; `phone:` y
      `local:owner` devuelven nulo. Pruebas puras del caso.
- [ ] 2.2 Migración local aditiva en `electron/memory/initializer.ts`: columna
      `uuid` en las cinco entidades sincronizables, con relleno idempotente para
      las filas existentes.
- [ ] 2.3 Crear la tabla local `sync_outbox` (entidad, uuid, operación,
      timestamp, intentos) y su índice.

## 3. Diario de sincronización

- [ ] 3.1 `electron/memory/sync-outbox.ts`: registrar alta, actualización y baja;
      leer lotes pendientes; marcar drenado y fallo con reintento. Módulo puro
      sobre `this.db`, con pruebas.
- [ ] 3.2 Anotar en el diario desde `saveMessage`, el guardado de resúmenes,
      `saveFact`, `saveSkill`, `deleteSkill` y `deleteFact`, solo cuando el owner
      es sincronizable.
- [ ] 3.3 Verificar que ninguna de esas rutas cambia su firma síncrona ni añade
      espera de red (prueba de regresión sobre el turno del agente).

## 4. Cliente remoto de memoria

- [ ] 4.1 `electron/memory/remote-store.ts` sobre `getHubDbClient()`: subida por
      lotes con `upsert` por `uuid`, baja por `uuid`, y lectura por `user_id`.
- [ ] 4.2 Fusión de skills en la subida conservando la semántica actual
      (refuerzo de confianza, contenido más reciente, `usage_count`).
- [ ] 4.3 Tolerancia a fallos: sin sesión, sin red o con error del servidor el
      lote permanece pendiente y se reintenta; nunca se pierde ni se duplica.

## 5. Sincronizador y ciclo de vida

- [ ] 5.1 `electron/memory/sync-runner.ts`: drenado periódico y a demanda,
      apagado por bandera de rollback, sin bloquear el turno del agente.
- [ ] 5.2 Enganchar el arranque de la sincronización a la sesión de main
      (`memory:set-current-user` y la restauración de `hub-session`), y detenerla
      al cerrar sesión.
- [ ] 5.3 Hidratación por prioridad al iniciar sesión: primero skills y hechos,
      después resúmenes, chunks y mensajes acotados por antigüedad.
- [ ] 5.4 Al cambiar de usuario, aislar la memoria del anterior: el agente deja
      de leerla y no se mezcla con la del nuevo.

## 6. Migración de la memoria existente

- [ ] 6.1 Subida única por equipo de la memoria local con owner `user:<id>`,
      marcada para no repetirse, idempotente ante reejecución.
- [ ] 6.2 Confirmar que la memoria con owner `phone:` o `local:owner` no sube.
- [ ] 6.3 Relink de WhatsApp: al ligar un número, su memoria pasa a `user:<id>` y
      entra en la cola sin duplicar lo ya sincronizado.

## 7. Control del usuario e interfaz

- [ ] 7.1 Propagar el borrado remoto en `memory:delete-skill` y en el borrado de
      hechos; el olvido sin conexión queda pendiente y se aplica al reconectar.
- [ ] 7.2 Exponer el estado de sincronización por IPC (servicio, handler,
      allowlist de preload y wrapper tipado) sin exponer contenido pendiente.
- [ ] 7.3 Mostrarlo en `src/components/memory/MemorySkillsCard.tsx` junto a la
      lista de skills.

## 8. Verificación

- [ ] 8.1 Pruebas de aislamiento RLS con dos usuarios: ninguno alcanza filas del
      otro en las cinco tablas.
- [ ] 8.2 Prueba de portabilidad: sembrar memoria como usuario A en un perfil,
      hidratar en otro perfil limpio y comprobar que las skills se aplican.
- [ ] 8.3 Prueba de corte de red: el turno se completa, lo aprendido queda
      pendiente y sube al reconectar sin duplicar.
- [ ] 8.4 `npm run typecheck`, `npm run test` y `npm run verify:pr`.
- [ ] 8.5 Verificación manual del rollback: con la bandera apagada el producto
      opera solo con SQLite.

## 9. Documentación y cierre

- [ ] 9.1 Actualizar `docs/data/data-architecture.md` (la memoria deja de ser
      solo local), `docs/architecture/runtime-agents-manual.md`,
      `docs/architecture/runtime-parameters.md` y `docs/standards/database.md`.
- [ ] 9.2 Registrar la evidencia en `verification.md` del cambio.
- [ ] 9.3 Revisión adversarial (`adversarial-review`) centrada en fuga entre
      dueños, borrados que reviven y estados parciales de sincronización.
