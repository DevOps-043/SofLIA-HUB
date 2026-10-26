-- Instancia: IRIS. Autorización explícita del usuario: 2026-10-24.
-- Precondición: hub_project_scope_v1 desplegada en SOFIA Learning.
-- Impacto: cierra el acceso sin sesión a autoridades y almacenamiento de proyectos.
-- No migra filas de negocio ni almacena JWT/credenciales. Reejecutable.
BEGIN;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS hub_private;
REVOKE ALL ON SCHEMA hub_private FROM PUBLIC;
GRANT USAGE ON SCHEMA hub_private TO anon, authenticated;

-- No sustituir un hook ajeno al volver a aplicar esta migración.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_db_role_setting s, unnest(s.setconfig) c
    WHERE s.setrole = 'authenticator'::regrole AND c LIKE 'pgrst.db_pre_request=%'
      AND c NOT IN ('pgrst.db_pre_request=', 'pgrst.db_pre_request=hub_private.verify_learning_request_v1'))
  THEN RAISE EXCEPTION 'Ya existe otro verificador de peticiones; conciliar antes de aplicar.'; END IF;
END $$;

CREATE OR REPLACE FUNCTION hub_private.scope_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(nullif(current_setting('soflia.verified_scope', true), '')::jsonb, '{}'::jsonb);
$$;

-- El único punto que establece contexto recibe una respuesta de Learning bajo
-- la sesión real. Ni UUID, rol, claims ni cabeceras del cliente conceden acceso.
-- Es privado, de sólo verificación; no escribe tablas ni eleva el rol Postgres.
CREATE OR REPLACE FUNCTION hub_private.verify_learning_request_v1()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE h jsonb; token text; public_key text; organization text;
  response extensions.http_response; verified jsonb;
BEGIN
  PERFORM set_config('soflia.verified_scope', '', true);
  h := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  token := h->>'x-soflia-token'; public_key := h->>'x-soflia-key'; organization := h->>'x-soflia-organization';
  IF token IS NULL AND public_key IS NULL AND organization IS NULL THEN RETURN; END IF;
  IF token IS NULL OR length(token) NOT BETWEEN 20 AND 16384 OR token !~ '^[A-Za-z0-9_.-]+$'
    OR public_key IS NULL OR length(public_key) NOT BETWEEN 20 AND 4096 OR public_key !~ '^[A-Za-z0-9_.-]+$'
    OR organization IS NULL OR organization !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN RAISE SQLSTATE 'PT401' USING MESSAGE = 'La sesión de proyectos no es válida.'; END IF;
  organization := organization::uuid::text;
  BEGIN
    PERFORM extensions.http_reset_curlopt();
    PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','3000');
    PERFORM extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','1500');
    PERFORM extensions.http_set_curlopt('CURLOPT_SSL_VERIFYPEER','1');
    PERFORM extensions.http_set_curlopt('CURLOPT_SSL_VERIFYHOST','2');
    SELECT * INTO response FROM extensions.http((
      'POST', 'https://mrqnnmuckznvukjvfkly.supabase.co/rest/v1/rpc/hub_project_scope_v1',
      ARRAY[ROW('Authorization', 'Bearer ' || token)::extensions.http_header,
        ROW('apikey', public_key)::extensions.http_header], 'application/json',
      jsonb_build_object('p_organization_id', organization)::text)::extensions.http_request);
    PERFORM extensions.http_reset_curlopt();
  EXCEPTION WHEN OTHERS THEN
    PERFORM extensions.http_reset_curlopt();
    RAISE SQLSTATE 'PT503' USING MESSAGE = 'No se pudo verificar la sesión de proyectos.';
  END;
  IF response.status IN (401, 403) THEN RAISE SQLSTATE 'PT401' USING MESSAGE = 'Inicia sesión para acceder a tus proyectos.'; END IF;
  IF response.status <> 200 THEN RAISE SQLSTATE 'PT503' USING MESSAGE = 'Learning no pudo verificar el acceso al proyecto.'; END IF;
  BEGIN verified := response.content::jsonb;
  EXCEPTION WHEN OTHERS THEN RAISE SQLSTATE 'PT503' USING MESSAGE = 'Respuesta de verificación no disponible.'; END;
  IF jsonb_typeof(verified) IS DISTINCT FROM 'object' OR verified->>'organization_id' IS DISTINCT FROM organization
    OR coalesce(verified->>'user_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR nullif(verified->>'role', '') IS NULL
  THEN RAISE SQLSTATE 'PT403' USING MESSAGE = 'No tienes una membresía activa en esta organización.'; END IF;
  PERFORM set_config('soflia.verified_scope', verified::text, true);
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS hub_account_sofia_identity_v1
  ON public.account_users(sofia_user_id) WHERE sofia_user_id IS NOT NULL;

-- Lookups privados mínimos para evitar recursión RLS entre proyecto y miembros.
-- La identidad procede del verificador, no de argumentos de la función.
CREATE OR REPLACE FUNCTION hub_private.actor_v1()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT a.user_id FROM public.account_users a
  WHERE (hub_private.scope_v1()->>'user_id') IS NOT NULL AND a.account_status = 'active'
    AND (a.sofia_user_id = (hub_private.scope_v1()->>'user_id')::uuid
      OR (a.user_id = (hub_private.scope_v1()->>'user_id')::uuid AND a.sofia_user_id IS NULL))
  ORDER BY a.sofia_user_id NULLS LAST LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION hub_private.workspace_v1(p_workspace uuid, p_member boolean DEFAULT true)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (hub_private.scope_v1()->>'user_id') IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.workspace_id = p_workspace AND w.is_active
      AND w.sofia_org_id = (hub_private.scope_v1()->>'organization_id')::uuid
      AND (NOT p_member OR EXISTS (SELECT 1 FROM public.workspace_members m
        WHERE m.workspace_id = w.workspace_id AND m.user_id = hub_private.actor_v1() AND m.is_active))
      AND NOT EXISTS (SELECT 1 FROM public.workspace_members m
        WHERE m.workspace_id = w.workspace_id AND m.user_id = hub_private.actor_v1() AND NOT coalesce(m.is_active, false))
  );
$$;

CREATE OR REPLACE FUNCTION hub_private.project_v1(p_project uuid, p_access text DEFAULT 'read')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT hub_private.actor_v1() IS NOT NULL AND p_access IN ('read','write','admin') AND EXISTS (
    SELECT 1 FROM public.pm_projects p WHERE p.project_id = p_project
      AND hub_private.workspace_v1(p.workspace_id) AND (
        hub_private.scope_v1()->>'role' IN ('owner','admin') OR p.created_by_user_id = hub_private.actor_v1()
        OR EXISTS (SELECT 1 FROM public.pm_project_members m WHERE m.project_id = p.project_id
          AND m.user_id = hub_private.actor_v1() AND m.membership_status = 'active'
          AND (p_access = 'read' OR m.project_role IN ('owner','admin')
            OR (p_access = 'write' AND m.project_role = 'member')))
      )
  );
$$;

CREATE OR REPLACE FUNCTION hub_private.workspace_user_v1(p_workspace uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT hub_private.workspace_v1(p_workspace) AND EXISTS (SELECT 1 FROM public.workspace_members m
    JOIN public.account_users a ON a.user_id = m.user_id AND a.account_status = 'active'
    WHERE m.workspace_id = p_workspace AND m.user_id = p_user AND m.is_active);
$$;

CREATE OR REPLACE FUNCTION hub_private.visible_account_v1(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT hub_private.actor_v1() IS NOT NULL AND (p_user = hub_private.actor_v1() OR EXISTS (
    SELECT 1 FROM public.workspace_members m WHERE m.user_id = p_user AND m.is_active
      AND hub_private.workspace_v1(m.workspace_id)));
$$;

CREATE OR REPLACE FUNCTION hub_private.evidence_v1(p_evidence uuid, p_access text DEFAULT 'read')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT hub_private.actor_v1() IS NOT NULL AND EXISTS (SELECT 1 FROM public.pm_project_evidence e
    JOIN public.pm_projects p ON p.project_id = e.project_id AND p.workspace_id = e.workspace_id
    WHERE e.evidence_id = p_evidence AND e.archived_at IS NULL AND hub_private.project_v1(e.project_id, p_access));
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA hub_private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA hub_private TO anon, authenticated;
-- El esquema no se expone en PostgREST. El verificador siempre limpia el contexto.

ALTER TABLE public.account_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_project_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_project_evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_project_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_read_policy ON public.workspaces;
DROP POLICY IF EXISTS workspace_members_read_policy ON public.workspace_members;
DROP POLICY IF EXISTS workspace_members_write_policy ON public.workspace_members;

-- Reemplazo idempotente exclusivamente de las políticas de esta unidad.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND policyname LIKE 'hub_storage_v1_%'
  LOOP EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename); END LOOP;
END $$;

REVOKE ALL ON public.account_users, public.workspaces, public.workspace_members,
  public.pm_projects, public.pm_project_members, public.pm_project_evidence,
  public.pm_project_evidence_items, public.pm_project_documents FROM PUBLIC, anon, authenticated;
GRANT SELECT(user_id,sofia_user_id,first_name,last_name_paternal,last_name_maternal,
  display_name,username,email,avatar_url,account_status) ON public.account_users TO anon, authenticated;
GRANT INSERT ON public.account_users TO anon, authenticated;
GRANT SELECT, INSERT ON public.workspaces, public.workspace_members, public.pm_projects,
  public.pm_project_evidence, public.pm_project_evidence_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pm_project_members TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_project_documents TO anon, authenticated;
GRANT UPDATE(project_name,project_description,priority_level,project_status,health_status,
  start_date,target_date,tags,lead_user_id,team_id,updated_at,archived_at) ON public.pm_projects TO anon, authenticated;
GRANT UPDATE(title,summary,archived_at,archived_by_user_id) ON public.pm_project_evidence TO anon, authenticated;

CREATE POLICY hub_storage_v1_account_read ON public.account_users FOR SELECT TO anon, authenticated
  USING (hub_private.visible_account_v1(user_id));
CREATE POLICY hub_storage_v1_account_insert ON public.account_users FOR INSERT TO anon, authenticated
  WITH CHECK (user_id = (hub_private.scope_v1()->>'user_id')::uuid AND sofia_user_id = user_id
    AND permission_level = 'user' AND account_status = 'active' AND password_hash = 'SOFIA_MANAGED_AUTH');
CREATE POLICY hub_storage_v1_workspace_read ON public.workspaces FOR SELECT TO anon, authenticated
  USING (sofia_org_id = (hub_private.scope_v1()->>'organization_id')::uuid AND is_active);
CREATE POLICY hub_storage_v1_workspace_insert ON public.workspaces FOR INSERT TO anon, authenticated
  WITH CHECK (sofia_org_id = (hub_private.scope_v1()->>'organization_id')::uuid AND is_active);
CREATE POLICY hub_storage_v1_workspace_member_read ON public.workspace_members FOR SELECT TO anon, authenticated
  USING (hub_private.workspace_v1(workspace_id, false));
CREATE POLICY hub_storage_v1_workspace_member_insert ON public.workspace_members FOR INSERT TO anon, authenticated
  WITH CHECK (hub_private.workspace_v1(workspace_id, false) AND user_id = hub_private.actor_v1() AND is_active
    AND sofia_role = hub_private.scope_v1()->>'role'
    AND iris_role = CASE WHEN hub_private.scope_v1()->>'role' IN ('owner','admin') THEN hub_private.scope_v1()->>'role' ELSE 'member' END);
CREATE POLICY hub_storage_v1_project_read ON public.pm_projects FOR SELECT TO anon, authenticated
  USING ((created_by_user_id = hub_private.actor_v1() AND hub_private.workspace_v1(workspace_id))
    OR hub_private.project_v1(project_id));
CREATE POLICY hub_storage_v1_project_insert ON public.pm_projects FOR INSERT TO anon, authenticated
  WITH CHECK (hub_private.workspace_v1(workspace_id) AND created_by_user_id = hub_private.actor_v1()
    AND (lead_user_id IS NULL OR hub_private.workspace_user_v1(workspace_id, lead_user_id))
    AND (team_id IS NULL OR EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = pm_projects.team_id AND t.workspace_id = pm_projects.workspace_id)));
CREATE POLICY hub_storage_v1_project_update ON public.pm_projects FOR UPDATE TO anon, authenticated
  USING (hub_private.project_v1(project_id, 'admin'))
  WITH CHECK (hub_private.project_v1(project_id, 'admin') AND hub_private.workspace_v1(workspace_id)
    AND (lead_user_id IS NULL OR hub_private.workspace_user_v1(workspace_id, lead_user_id))
    AND (team_id IS NULL OR EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = pm_projects.team_id AND t.workspace_id = pm_projects.workspace_id)));
CREATE POLICY hub_storage_v1_member_read ON public.pm_project_members FOR SELECT TO anon, authenticated
  USING (hub_private.project_v1(project_id));
CREATE POLICY hub_storage_v1_member_insert ON public.pm_project_members FOR INSERT TO anon, authenticated
  WITH CHECK (hub_private.project_v1(project_id,'admin') AND invited_by_user_id = hub_private.actor_v1()
    AND project_role IN ('admin','member','viewer','guest') AND EXISTS (SELECT 1 FROM public.pm_projects p
      WHERE p.project_id = pm_project_members.project_id AND hub_private.workspace_user_v1(p.workspace_id, pm_project_members.user_id)));
CREATE POLICY hub_storage_v1_member_update ON public.pm_project_members FOR UPDATE TO anon, authenticated
  USING (hub_private.project_v1(project_id,'admin') AND project_role <> 'owner')
  WITH CHECK (hub_private.project_v1(project_id,'admin') AND project_role IN ('admin','member','viewer','guest')
    AND EXISTS (SELECT 1 FROM public.pm_projects p WHERE p.project_id = pm_project_members.project_id
      AND hub_private.workspace_user_v1(p.workspace_id, pm_project_members.user_id)));
CREATE POLICY hub_storage_v1_evidence_read ON public.pm_project_evidence FOR SELECT TO anon, authenticated
  USING (hub_private.workspace_v1(workspace_id) AND hub_private.project_v1(project_id)
    AND EXISTS (SELECT 1 FROM public.pm_projects p WHERE p.project_id = pm_project_evidence.project_id AND p.workspace_id = pm_project_evidence.workspace_id));
CREATE POLICY hub_storage_v1_evidence_insert ON public.pm_project_evidence FOR INSERT TO anon, authenticated
  WITH CHECK (hub_private.workspace_v1(workspace_id) AND hub_private.project_v1(project_id,'write')
    AND created_by_user_id = hub_private.actor_v1() AND archived_at IS NULL AND archived_by_user_id IS NULL
    AND EXISTS (SELECT 1 FROM public.pm_projects p WHERE p.project_id = pm_project_evidence.project_id AND p.workspace_id = pm_project_evidence.workspace_id));
CREATE POLICY hub_storage_v1_evidence_update ON public.pm_project_evidence FOR UPDATE TO anon, authenticated
  USING (hub_private.project_v1(project_id,'admin') AND hub_private.workspace_v1(workspace_id))
  WITH CHECK (hub_private.project_v1(project_id,'admin') AND hub_private.workspace_v1(workspace_id)
    AND (archived_by_user_id IS NULL OR archived_by_user_id = hub_private.actor_v1()));
CREATE POLICY hub_storage_v1_item_read ON public.pm_project_evidence_items FOR SELECT TO anon, authenticated
  USING (hub_private.evidence_v1(evidence_id));
CREATE POLICY hub_storage_v1_item_insert ON public.pm_project_evidence_items FOR INSERT TO anon, authenticated
  WITH CHECK (hub_private.evidence_v1(evidence_id,'write'));
CREATE POLICY hub_storage_v1_document_read ON public.pm_project_documents FOR SELECT TO anon, authenticated
  USING (hub_private.project_v1(project_id));
CREATE POLICY hub_storage_v1_document_insert ON public.pm_project_documents FOR INSERT TO anon, authenticated
  WITH CHECK (hub_private.project_v1(project_id,'write') AND created_by = hub_private.actor_v1());
CREATE POLICY hub_storage_v1_document_update ON public.pm_project_documents FOR UPDATE TO anon, authenticated
  USING (hub_private.project_v1(project_id,'write')) WITH CHECK (hub_private.project_v1(project_id,'write'));
CREATE POLICY hub_storage_v1_document_delete ON public.pm_project_documents FOR DELETE TO anon, authenticated
  USING (hub_private.project_v1(project_id,'write'));

-- Esta función heredada aceptaba un actor arbitrario y omitía RLS. El backend
-- directo ya protege la titularidad y no la utiliza. Mantener sólo servidor.
REVOKE EXECUTE ON FUNCTION public.project_hub_transfer_ownership(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.project_hub_transfer_ownership(uuid,uuid,uuid) TO service_role;
ALTER ROLE authenticator SET pgrst.db_pre_request = 'hub_private.verify_learning_request_v1';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
COMMIT;
