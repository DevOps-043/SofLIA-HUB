# Estandar de base de datos

## Instancias

- `database/lia/`: `VITE_SUPABASE_URL`; chat, monitoreo, reuniones y estado
  operativo del Hub.
- `database/iris/`: proyectos, issues, CRM y workflows compartidos.
- `database/sofia-learning/`: identidad, usuarios y datos compartidos con
  SofLIA Learning.
- `database/shared/`: auditorias o cambios que declaran explicitamente varias
  instancias.

## Reglas

- Cada SQL debe indicar instancia, precondiciones, impacto e idempotencia.
- Snapshots son contexto y no deben ejecutarse como migraciones.
- Una migracion destructiva debe incluir consulta previa, respaldo y rollback.
- Verificar RLS para SELECT, INSERT, UPDATE y DELETE.
- No confiar solo en aislamiento de aplicacion cuando existe `auth.uid()`.
- Mantener `trace_id` e `idempotency_key` en workflows que produzcan efectos.
- Registrar la ejecucion real fuera del repositorio; un archivo SQL no prueba que
  una migracion haya sido aplicada.

## Tablas globales sin dueño

Una tabla sin `user_id` no puede apoyarse en `auth.uid()` para aislar nada, asi
que su modelo de permisos es explicito:

- `public.system_skills` (instancia Lia) es el catalogo de Skills del sistema.
  RLS declara **una sola** politica, de `SELECT` para `authenticated` con
  `USING (true)`. No se declara ninguna de `INSERT`, `UPDATE` ni `DELETE`: sin
  politica, RLS deniega, y solo `service_role` escribe. Anadir una politica de
  escritura convertiria una fila en control remoto del equipo del usuario,
  porque la fila declara herramientas y politica de espacio de trabajo.
- Lo que la fila declara se **acota en el cliente**
  (`src/shared/skills/system-catalog.ts`), no en el esquema: la lista de
  herramientas concedibles y los limites de tamano son propiedades de la version
  instalada y cambian con el producto, no con la base de datos.
- El respaldo vive en codigo: la ausencia de filas no retira una capacidad. Solo
  `enabled = false` lo hace. La semilla se genera con `npm run skills:seed` y
  `npm run verify:pr` falla si diverge del registro en codigo.
