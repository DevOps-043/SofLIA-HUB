-- Instancia: SOFIA Learning. Autorización explícita del usuario: 2026-10-24.
-- Lectura del ámbito propio; no modifica identidad, membresías ni configuración Auth.
-- Precondición: RLS vigente en organizations y organization_users.
-- Reejecutable. Rollback: retirar esta función tras retirar el hook de IRIS.
BEGIN;
CREATE OR REPLACE FUNCTION public.hub_project_scope_v1(p_organization_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('user_id', m.user_id, 'organization_id', o.id, 'role', m.role)
  FROM public.organization_users m
  JOIN public.organizations o ON o.id = m.organization_id AND o.is_active
  WHERE m.user_id = (SELECT auth.uid()) AND m.organization_id = p_organization_id
    AND m.status = 'active'
    AND current_user = 'authenticated'
    AND NOT coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.hub_project_scope_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_project_scope_v1(uuid) TO authenticated;
COMMENT ON FUNCTION public.hub_project_scope_v1(uuid) IS
  'Ámbito propio de proyectos, leído bajo la sesión y RLS de Learning; no acepta user_id ni roles del cliente.';
NOTIFY pgrst, 'reload schema';
COMMIT;
