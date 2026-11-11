-- IRIS. Ajustes de la misma unidad autorizada el 2026-10-24; sin cambios de filas.
-- Mínimo privilegio de referencias e índices para las consultas vigentes.
BEGIN;
REVOKE UPDATE ON public.pm_project_documents FROM anon, authenticated;
GRANT UPDATE(name,doc_type,updated_at) ON public.pm_project_documents TO anon, authenticated;
-- Retirar sólo el índice agregado por esta unidad si el previo es equivalente.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_index a JOIN pg_index b ON a.indrelid=b.indrelid
    WHERE a.indexrelid=to_regclass('public.hub_account_sofia_identity_v1')
      AND b.indexrelid=to_regclass('public.idx_account_users_sofia_user_id')
      AND b.indisunique AND b.indisvalid AND a.indkey=b.indkey
      AND a.indclass=b.indclass AND a.indcollation=b.indcollation
      AND a.indpred::text IS NOT DISTINCT FROM b.indpred::text)
  THEN DROP INDEX public.hub_account_sofia_identity_v1; END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS hub_project_member_identity_v1 ON public.pm_project_members(project_id,user_id);
CREATE INDEX IF NOT EXISTS hub_project_member_user_v1 ON public.pm_project_members(user_id,project_id);
CREATE INDEX IF NOT EXISTS hub_project_creator_v1 ON public.pm_projects(created_by_user_id,workspace_id);
NOTIFY pgrst,'reload schema';
COMMIT;
