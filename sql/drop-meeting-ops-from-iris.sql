-- =====================================================================
-- Limpieza: eliminar las tablas de Meeting Ops de la instancia IRIS.
--
-- EJECUTAR EN IRIS (SQL Editor) SOLO DESPUES de:
--   1. Haber creado las tablas en la base de SofLIA Hub
--      (sql/meeting-ops-tables.sql en VITE_SUPABASE_URL), y
--   2. Confirmar que no hay datos en IRIS que quieras conservar
--      (estas tablas se crearon en IRIS por error de arquitectura;
--       si hubo corridas de prueba, se pierden con este script).
--
-- DESTRUCTIVO E IRREVERSIBLE. Revisa cada tabla antes de correrlo:
--   SELECT count(*) FROM public.meeting_runs;
-- =====================================================================

DROP TABLE IF EXISTS public.meeting_approvals CASCADE;
DROP TABLE IF EXISTS public.meeting_sync_actions CASCADE;
DROP TABLE IF EXISTS public.meeting_assets CASCADE;
DROP TABLE IF EXISTS public.meeting_source_artifacts CASCADE;
DROP TABLE IF EXISTS public.meeting_detection_candidates CASCADE;
DROP TABLE IF EXISTS public.meeting_runs CASCADE;
