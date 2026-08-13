-- =====================================================================
-- SofLIA Hub - Retiro del Registro Operativo Gobernado (SDO)
-- EJECUTAR EN LA INSTANCIA SUPABASE DE SOFLIA HUB (VITE_SUPABASE_URL),
-- en el SQL Editor. NO en IRIS.
--
-- MIGRACION DESTRUCTIVA: elimina las tablas del SDO y todo su contenido.
-- El producto ya no tiene registro de decisiones: se retiraron la vista
-- del Hub, los canales IPC `sdo:*`, las herramientas `sdo_query` /
-- `sdo_propose` del agente de WhatsApp y el adaptador de reuniones.
-- Reemplaza a: sdo-tables.sql, sdo-artifacts.sql, sdo-generation-vigencia.sql
-- (los tres archivos fueron borrados del repositorio).
--
-- PRECONDICIONES
--   1. Ninguna instancia del Hub anterior a este cambio sigue en uso:
--      una version antigua escribiria en tablas inexistentes y las
--      llamadas fallarian (el SDO nunca bloqueaba el flujo de reuniones,
--      pero registraria errores).
--   2. Nada fuera del Hub consulta estas tablas (no habia otro cliente).
--
-- RESPALDO PREVIO (ejecutar ANTES del bloque destructivo)
--   Estas tablas son append-only por diseno y su valor es la trazabilidad,
--   asi que respalda aunque parezcan vacias. Opcion A, en el SQL Editor:
--
--     SELECT * FROM public.sdo_decisions;      -- exportar como CSV
--     SELECT * FROM public.sdo_claims;
--     SELECT * FROM public.sdo_actions;
--     SELECT * FROM public.sdo_approvals;
--     SELECT * FROM public.sdo_audit_events;
--     SELECT * FROM public.sdo_artifacts;
--     SELECT * FROM public.sdo_evidence;
--     SELECT * FROM public.sdo_sources;
--     SELECT * FROM public.sdo_generation_runs;
--
--   Opcion B, copia dentro de la misma base (mas rapida de revertir):
--
--     CREATE SCHEMA IF NOT EXISTS sdo_backup;
--     CREATE TABLE sdo_backup.sdo_sources         AS TABLE public.sdo_sources;
--     CREATE TABLE sdo_backup.sdo_evidence        AS TABLE public.sdo_evidence;
--     CREATE TABLE sdo_backup.sdo_claims          AS TABLE public.sdo_claims;
--     CREATE TABLE sdo_backup.sdo_decisions       AS TABLE public.sdo_decisions;
--     CREATE TABLE sdo_backup.sdo_actions         AS TABLE public.sdo_actions;
--     CREATE TABLE sdo_backup.sdo_approvals       AS TABLE public.sdo_approvals;
--     CREATE TABLE sdo_backup.sdo_audit_events    AS TABLE public.sdo_audit_events;
--     CREATE TABLE sdo_backup.sdo_artifacts       AS TABLE public.sdo_artifacts;
--     CREATE TABLE sdo_backup.sdo_generation_runs AS TABLE public.sdo_generation_runs;
--
-- CONSULTA PREVIA (cuanto se va a perder)
--     SELECT 'sdo_decisions' AS tabla, count(*) FROM public.sdo_decisions
--     UNION ALL SELECT 'sdo_claims', count(*) FROM public.sdo_claims
--     UNION ALL SELECT 'sdo_actions', count(*) FROM public.sdo_actions
--     UNION ALL SELECT 'sdo_approvals', count(*) FROM public.sdo_approvals
--     UNION ALL SELECT 'sdo_audit_events', count(*) FROM public.sdo_audit_events
--     UNION ALL SELECT 'sdo_artifacts', count(*) FROM public.sdo_artifacts
--     UNION ALL SELECT 'sdo_evidence', count(*) FROM public.sdo_evidence
--     UNION ALL SELECT 'sdo_sources', count(*) FROM public.sdo_sources
--     UNION ALL SELECT 'sdo_generation_runs', count(*) FROM public.sdo_generation_runs;
--
-- IMPACTO
--   - Se pierden decisiones, afirmaciones, acciones, aprobaciones,
--     bitacora append-only, artefactos y corridas de generacion del SDO.
--   - Las reuniones NO se tocan: `meeting_*` sigue intacto, con sus
--     minutas, acciones y aprobaciones. Solo desaparece el espejo en SDO.
--
-- IDEMPOTENCIA: `DROP ... IF EXISTS` + CASCADE. Reejecutable sin error;
-- si las tablas nunca se crearon, no hace nada.
--
-- ROLLBACK: no se puede deshacer con SQL una vez ejecutado. Para volver
-- atras hay que restaurar el respaldo y recuperar del historial de git
-- los tres SQL borrados (sdo-tables.sql, sdo-artifacts.sql,
-- sdo-generation-vigencia.sql) junto con el codigo del SDO.
-- =====================================================================

-- El trigger append-only de la bitacora bloquea UPDATE/DELETE, no DROP,
-- pero se retira primero para dejar el objeto sin dependencias.
DROP TRIGGER IF EXISTS trg_sdo_audit_append_only ON public.sdo_audit_events;
DROP FUNCTION IF EXISTS public.sdo_audit_events_bloquear_mutacion() CASCADE;

-- Orden hijo -> padre; CASCADE cubre indices, politicas RLS y llaves
-- foraneas restantes.
DROP TABLE IF EXISTS public.sdo_generation_runs CASCADE;
DROP TABLE IF EXISTS public.sdo_artifacts CASCADE;
DROP TABLE IF EXISTS public.sdo_audit_events CASCADE;
DROP TABLE IF EXISTS public.sdo_approvals CASCADE;
DROP TABLE IF EXISTS public.sdo_actions CASCADE;
DROP TABLE IF EXISTS public.sdo_decisions CASCADE;
DROP TABLE IF EXISTS public.sdo_claims CASCADE;
DROP TABLE IF EXISTS public.sdo_evidence CASCADE;
DROP TABLE IF EXISTS public.sdo_sources CASCADE;

-- VERIFICACION: debe devolver cero filas.
--     SELECT tablename FROM pg_tables
--      WHERE schemaname = 'public' AND tablename LIKE 'sdo\_%';
