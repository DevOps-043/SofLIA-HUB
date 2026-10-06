-- =====================================================================
-- Miembros de una organizacion para el escritorio, sin reabrir public.users
-- EJECUTAR EN LA INSTANCIA SUPABASE DE SOFIA LEARNING (mrqnnmuckznvukjvfkly).
-- NO en Pulse Hub ni en IRIS.
--
-- Precondicion: desktop-users-read-access.sql ya aplicado (mismo patron).
--
-- Contexto: tras retirar el SELECT sobre public.users, la lista de miembros
-- de Ajustes > Equipo & Productividad y el selector de personas del modal
-- Compartir dejaron de cargar. Ambos embebian `users!user_id (*)` desde
-- organization_users y PostgREST rechaza la consulta completa. Ademas `*`
-- traia telefono, fecha de nacimiento, genero y motivo de baneo que ninguna
-- pantalla usa.
--
-- Por que una funcion y no restaurar el GRANT o una politica RLS: igual que
-- en desktop-users-read-access.sql, la clave anon viaja en el ejecutable y
-- esta instancia la comparte SofLIA Learning. Este script es aditivo: no toca
-- permisos, politicas ni RLS de tablas existentes.
--
-- Superficie que se expone, explicitamente:
--   - Solo a usuarios autenticados que sean miembros ACTIVOS de la
--     organizacion pedida. Cualquier otro llamador recibe cero filas.
--   - Por miembro: datos de la membresia y el minimo de perfil que muestran
--     las pantallas (usuario, correo, nombre visible, nombre, apellido y foto).
--     Nunca telefono, fecha de nacimiento, genero, ubicacion ni estado de baneo.
--   - Omite membresias con estado 'removed'.
--   - Paginada: p_limit se acota a 1..1000 (por defecto 500).
--
-- Indice usado: idx_sofia_organization_users_org_status
-- (performance-hardening.sql). Sin el, la funcion sigue siendo correcta.
--
-- Idempotencia: CREATE OR REPLACE; puede ejecutarse varias veces.
-- Rollback: ver el bloque ROLLBACK al final del archivo.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_desktop_organization_members(
  p_organization_id uuid,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  user_id uuid,
  role character varying,
  status character varying,
  job_title text,
  team_id uuid,
  joined_at timestamp without time zone,
  created_at timestamp without time zone,
  username text,
  email text,
  display_name text,
  first_name text,
  last_name text,
  profile_picture_url text
)
LANGUAGE sql
SECURITY DEFINER
-- search_path fijo: sin esto un esquema en el path del llamador podria
-- suplantar las tablas dentro de una funcion SECURITY DEFINER.
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT m.id, m.organization_id, m.user_id, m.role, m.status, m.job_title,
         m.team_id, m.joined_at, m.created_at,
         u.username, u.email, u.display_name, u.first_name, u.last_name,
         u.profile_picture_url
  FROM public.organization_users m
  LEFT JOIN public.users u ON u.id = m.user_id
  WHERE m.organization_id = p_organization_id
    AND m.status <> 'removed'
    -- Autorizacion: quien llama debe ser miembro activo de esa organizacion.
    -- Sin sesion, auth.uid() es NULL y el EXISTS es falso.
    AND EXISTS (
      SELECT 1
      FROM public.organization_users caller
      WHERE caller.organization_id = p_organization_id
        AND caller.user_id = auth.uid()
        AND caller.status = 'active'
    )
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
           lower(coalesce(u.display_name, u.username, '')),
           m.id
  LIMIT least(greatest(coalesce(p_limit, 500), 1), 1000)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.get_desktop_organization_members(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_desktop_organization_members(uuid, integer, integer) TO authenticated;

-- PostgREST responde PGRST202 («función no encontrada») hasta que recarga su
-- cache de esquema. Esta notificación la fuerza sin reiniciar nada.
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- Verificacion
-- ---------------------------------------------------------------------
-- Debe existir y ser SECURITY DEFINER.
SELECT p.proname, p.prosecdef AS security_definer, p.provolatile
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_desktop_organization_members';

-- Solo authenticated puede ejecutarla; anon no debe aparecer.
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'get_desktop_organization_members'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC');

-- public.users sigue SIN permiso directo de lectura: cero filas.
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type = 'SELECT';

-- ---------------------------------------------------------------------
-- ROLLBACK (la lista de miembros vuelve a fallar; no persiste estado)
-- ---------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.get_desktop_organization_members(uuid, integer, integer);
