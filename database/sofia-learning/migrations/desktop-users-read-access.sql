-- =====================================================================
-- Acceso del escritorio a public.users sin reabrir la tabla
-- EJECUTAR EN LA INSTANCIA SUPABASE DE SOFIA LEARNING (mrqnnmuckznvukjvfkly).
-- NO en Pulse Hub ni en IRIS.
--
-- Contexto: al endurecer la instancia se retiro el permiso de lectura sobre
-- public.users. Eso dejo a Pulse Hub sin poder iniciar sesion ni resolver el
-- perfil, porque el escritorio leia esa tabla directamente:
--   1) antes de autenticar, con la clave anon, para traducir el usuario a su
--      correo (el login acepta usuario o correo);
--   2) ya autenticado, para leer su propia fila de perfil.
--
-- Por que no se restaura el GRANT: la clave anon viaja dentro del ejecutable
-- de escritorio, asi que devolver SELECT sobre public.users a anon permitiria
-- a cualquiera enumerar correo, telefono, fecha de nacimiento y ubicacion de
-- todos los usuarios. El endurecimiento fue correcto; lo que estaba mal era
-- que el cliente dependiera de ese permiso.
--
-- Por que dos funciones y no politicas RLS: esta instancia la comparte SofLIA
-- Learning. Activar o alterar RLS sobre public.users cambiaria el acceso de
-- ese producto tambien. Este script es puramente aditivo: no toca permisos,
-- politicas ni estado de RLS de ninguna tabla existente, solo agrega dos
-- funciones acotadas. No puede romper a Learning.
--
-- Superficie que se expone, explicitamente:
--   - resolve_desktop_login_email: sin sesion, devuelve UNICAMENTE el correo
--     de una cuenta dado su usuario o su correo. Es el minimo irreducible
--     para que signInWithPassword funcione con nombre de usuario. No devuelve
--     nombre, telefono, rol ni ningun otro dato. Sigue permitiendo confirmar
--     si un usuario existe: mitigarlo mas exige limitar la tasa en el borde
--     (ver nota al final), no ampliar ni reducir esta funcion.
--   - get_desktop_user_profile: exige sesion y devuelve solo la fila de quien
--     llama (auth.uid()). No puede leer la fila de nadie mas.
--
-- Idempotencia: CREATE OR REPLACE; puede ejecutarse varias veces.
-- Rollback: ver el bloque ROLLBACK al final del archivo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Resolucion previa al login: identificador -> correo
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_desktop_login_email(identifier text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
-- search_path fijo: sin esto un esquema en el path del llamador podria
-- suplantar a public.users dentro de una funcion SECURITY DEFINER.
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT u.email
  FROM public.users u
  WHERE btrim(coalesce(identifier, '')) <> ''
    AND CASE
          -- Se compara por igualdad y no con ilike: el identificador es un
          -- literal, no un patron, y ilike dejaria que '%' devolviera una
          -- cuenta cualquiera.
          WHEN position('@' IN identifier) > 0 THEN lower(u.email) = lower(btrim(identifier))
          ELSE lower(u.username) = lower(btrim(identifier))
        END
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_desktop_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_desktop_login_email(text) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Perfil propio, ya autenticado
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_desktop_user_profile()
RETURNS TABLE (
  id uuid,
  username text,
  email text,
  first_name text,
  last_name text,
  display_name text,
  phone character varying,
  profile_picture_url text,
  platform_role text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT u.id, u.username, u.email, u.first_name, u.last_name,
         u.display_name, u.phone, u.profile_picture_url, u.platform_role
  FROM public.users u
  -- Sin sesion, auth.uid() es NULL y no hay fila que devolver.
  WHERE u.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_desktop_user_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_desktop_user_profile() TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Verificacion
-- ---------------------------------------------------------------------
-- Las dos funciones deben existir y ser SECURITY DEFINER.
SELECT p.proname, p.prosecdef AS security_definer, p.provolatile
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('resolve_desktop_login_email', 'get_desktop_user_profile')
ORDER BY p.proname;

-- Permisos efectivos: anon solo sobre la resolucion de correo.
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('resolve_desktop_login_email', 'get_desktop_user_profile')
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY routine_name, grantee;

-- Debe seguir SIN permiso directo de lectura sobre la tabla: cero filas.
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type = 'SELECT';

-- ---------------------------------------------------------------------
-- NOTA OPERATIVA (no la aplica este script)
-- resolve_desktop_login_email es consultable sin sesion, luego permite
-- confirmar si un usuario existe. Conviene limitar la tasa por IP en el
-- borde de PostgREST. Retirarla sin reemplazo devuelve el login por nombre
-- de usuario al estado roto; el escritorio seguiria funcionando solo con
-- correo.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- ROLLBACK (deja de nuevo al escritorio sin acceso a public.users)
-- Ninguna fila depende de estas funciones: no persisten estado.
-- ---------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.get_desktop_user_profile();
-- DROP FUNCTION IF EXISTS public.resolve_desktop_login_email(text);
