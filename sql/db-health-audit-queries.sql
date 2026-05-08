-- =====================================================================
-- SofLIA Hub - auditoria de salud para Supabase/Postgres
-- Ejecutar en cada instancia por separado: Lia, IRIS y SOFIA/Learning.
-- No modifica datos. Sirve para decidir que indices/politicas aplicar.
-- =====================================================================

-- 1) Conexiones por estado. Si active crece sin bajar, hay consultas lentas
-- o clientes reteniendo conexiones.
SELECT
  datname,
  usename,
  state,
  count(*) AS connections
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY datname, usename, state
ORDER BY connections DESC;

-- 2) Consultas activas de mas de 10 segundos.
SELECT
  pid,
  usename,
  state,
  now() - query_start AS duration,
  wait_event_type,
  wait_event,
  left(query, 500) AS query_preview
FROM pg_stat_activity
WHERE datname = current_database()
  AND state <> 'idle'
  AND query_start < now() - interval '10 seconds'
ORDER BY duration DESC;

-- 3) Tablas mas grandes y estimacion de filas.
SELECT
  schemaname,
  relname AS table_name,
  n_live_tup AS estimated_rows,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS table_size,
  pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 30;

-- 4) Tablas con muchos scans secuenciales. Revisar contra rutas calientes.
SELECT
  schemaname,
  relname AS table_name,
  seq_scan,
  idx_scan,
  n_live_tup AS estimated_rows,
  round(100.0 * seq_scan / greatest(seq_scan + idx_scan, 1), 2) AS seq_scan_pct
FROM pg_stat_user_tables
WHERE n_live_tup > 1000
ORDER BY seq_scan_pct DESC, n_live_tup DESC
LIMIT 30;

-- 5) Indices existentes en tablas criticas.
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'conversations',
    'messages',
    'folders',
    'conversation_shares',
    'folder_shares',
    'workspace_sources',
    'activity_logs',
    'monitoring_sessions',
    'teams',
    'pm_projects',
    'task_issues',
    'task_statuses',
    'task_priorities',
    'team_members',
    'account_users',
    'users',
    'organization_users',
    'organization_teams',
    'courses',
    'course_modules',
    'course_lessons',
    'user_course_enrollments',
    'user_lesson_progress',
    'courseengine_inbox'
  )
ORDER BY tablename, indexname;

-- 6) Politicas RLS. Buscar politicas USING (true) / WITH CHECK (true)
-- en tablas con PII o datos multi-tenant.
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 7) Foreign keys sin indice completo en la tabla hija.
WITH fk_columns AS (
  SELECT
    c.oid AS constraint_oid,
    c.conrelid,
    c.conname,
    array_agg(a.attname ORDER BY x.ordinality) AS column_names,
    c.conkey AS column_numbers
  FROM pg_constraint c
  JOIN unnest(c.conkey) WITH ORDINALITY AS x(attnum, ordinality) ON true
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.attnum
  WHERE c.contype = 'f'
  GROUP BY c.oid, c.conrelid, c.conname, c.conkey
)
SELECT
  conrelid::regclass AS table_name,
  conname AS foreign_key,
  column_names
FROM fk_columns fk
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_index i
  WHERE i.indrelid = fk.conrelid
    AND i.indisvalid
    AND i.indkey::smallint[] @> fk.column_numbers
)
ORDER BY table_name::text, foreign_key;

-- 8) Si pg_stat_statements esta habilitado, ejecutar este bloque aparte:
-- SELECT
--   calls,
--   round(total_exec_time::numeric, 2) AS total_ms,
--   round(mean_exec_time::numeric, 2) AS mean_ms,
--   rows,
--   left(query, 500) AS query_preview
-- FROM pg_stat_statements
-- WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
-- ORDER BY total_exec_time DESC
-- LIMIT 30;
