-- Instancia SOFIA Learning. Requiere las columnas existentes de public.users
-- utilizadas por auth-supabase-hub.sql. Permite al canje de Lia consultar sólo
-- la evidencia de correo de la identidad autenticada. Es idempotente.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_desktop_own_email_verification()
RETURNS TABLE (
  id uuid,
  email text,
  email_verified boolean,
  email_verified_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT u.id, u.email, u.email_verified, u.email_verified_at
  FROM public.users AS u
  WHERE u.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_desktop_own_email_verification() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_desktop_own_email_verification() TO authenticated;

COMMIT;

-- Rollback: revertir primero la función Edge de Lia que invoca este RPC.
-- DROP FUNCTION IF EXISTS public.get_desktop_own_email_verification();
