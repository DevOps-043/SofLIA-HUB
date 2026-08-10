-- =====================================================================
-- Tickets de un solo uso para el inicio de sesion federado del escritorio
-- EJECUTAR EN LA INSTANCIA SUPABASE DE SOFIA LEARNING (mrqnnmuckznvukjvfkly).
-- NO en Pulse Hub ni en IRIS.
--
-- Contexto: SofLIA Learning implementa su SSO de Google y Microsoft por su
-- cuenta y cierra el flujo con tokens propios, sin producir una sesion de
-- Supabase Auth. Ademas, el alta por OAuth crea el usuario en auth.users
-- SIN contrasena, por lo que el escritorio no puede autenticarlo con
-- signInWithPassword. Esta tabla es el puente: Learning emite aqui un
-- ticket de un solo uso al terminar su propio SSO y el escritorio lo canjea
-- por una sesion Supabase legitima.
--
-- Por que se guarda el hash y no el ticket: quien lea la tabla no debe poder
-- suplantar a nadie. El valor en claro solo existe en transito.
--
-- Por que hay un desafio: el ticket vuelve al escritorio por un esquema de
-- URL propio, que en Windows cualquier aplicacion puede registrar. El ticket
-- por si solo es inservible; el canje exige ademas el verificador que solo
-- posee la instancia que inicio el flujo.
--
-- Idempotencia: todo el script usa IF NOT EXISTS / CREATE OR REPLACE y puede
-- ejecutarse varias veces con el mismo resultado.
--
-- Rollback: ver el bloque ROLLBACK al final del archivo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabla de tickets
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.desktop_sso_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SHA-256 en hexadecimal del ticket. El valor en claro nunca se persiste.
  token_hash text NOT NULL,
  -- SHA-256 en base64url del verificador que genero el escritorio (PKCE S256).
  code_challenge text NOT NULL CHECK (length(btrim(code_challenge)) > 0),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  -- Auditoria de emision. No se usa para autorizar: la identidad sale de user_id.
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_sso_tickets_hash
  ON public.desktop_sso_tickets(token_hash);

-- Soporte de la limpieza periodica; no participa en el canje.
CREATE INDEX IF NOT EXISTS idx_desktop_sso_tickets_expiracion
  ON public.desktop_sso_tickets(expires_at);

COMMENT ON TABLE public.desktop_sso_tickets IS
  'Tickets de un solo uso que ligan el SSO web de Learning con una sesion de escritorio. Solo el rol de servicio los usa. El ticket en claro nunca se guarda.';

-- ---------------------------------------------------------------------
-- 2. RLS sin politicas (negar por defecto)
--    La tabla solo la toca el backend de Learning con clave de servicio,
--    que no pasa por RLS. No declarar politicas es lo que garantiza que
--    ninguna sesion de usuario pueda leerla ni escribirla.
-- ---------------------------------------------------------------------
ALTER TABLE public.desktop_sso_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_sso_tickets FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.desktop_sso_tickets FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Consumo atomico
--    Un UPDATE condicional con RETURNING: el bloqueo de fila de Postgres
--    hace que dos canjes simultaneos del mismo ticket no puedan prosperar
--    ambos. La ventana de validez se evalua con el reloj del servidor, no
--    con el del cliente.
--
--    Devuelve el desafio junto al usuario para que el backend compare el
--    verificador DESPUES de haber marcado el consumo: un verificador
--    incorrecto quema el ticket, que es justo lo que se quiere frente a un
--    atacante que lo intercepto e intenta adivinar.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_desktop_sso_ticket(p_token_hash text)
RETURNS TABLE (user_id uuid, code_challenge text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.desktop_sso_tickets AS t
  SET consumed_at = now()
  WHERE t.token_hash = p_token_hash
    AND t.consumed_at IS NULL
    AND t.expires_at > now()
  RETURNING t.user_id, t.code_challenge;
$$;

REVOKE ALL ON FUNCTION public.consume_desktop_sso_ticket(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_desktop_sso_ticket(text) TO service_role;

COMMENT ON FUNCTION public.consume_desktop_sso_ticket(text) IS
  'Marca un ticket como consumido y devuelve su usuario y desafio, o ninguna fila si no existe, expiro o ya se uso.';

-- ---------------------------------------------------------------------
-- 4. Limpieza
--    Los tickets vencidos o consumidos no sirven para nada. Se conservan
--    un dia por si hace falta auditar un incidente reciente.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_desktop_sso_tickets()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH eliminados AS (
    DELETE FROM public.desktop_sso_tickets
    WHERE created_at < now() - interval '1 day'
    RETURNING 1
  )
  SELECT count(*) FROM eliminados;
$$;

REVOKE ALL ON FUNCTION public.purge_desktop_sso_tickets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_desktop_sso_tickets() TO service_role;

-- ---------------------------------------------------------------------
-- 5. Verificacion
-- ---------------------------------------------------------------------
-- RLS activa y sin politicas: debe devolver rls_activa = true y politicas = 0.
SELECT
  c.relrowsecurity AS rls_activa,
  c.relforcerowsecurity AS rls_forzada,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'desktop_sso_tickets') AS politicas
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'desktop_sso_tickets';

-- Las dos funciones deben existir y ser SECURITY DEFINER.
SELECT p.proname, p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('consume_desktop_sso_ticket', 'purge_desktop_sso_tickets')
ORDER BY p.proname;

-- ---------------------------------------------------------------------
-- ROLLBACK (ejecutar solo si hay que retirar el inicio federado)
-- No hay dato de producto que dependa de esta tabla: los tickets son
-- efimeros y ninguna otra fila los referencia.
-- ---------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.purge_desktop_sso_tickets();
-- DROP FUNCTION IF EXISTS public.consume_desktop_sso_ticket(text);
-- DROP TABLE IF EXISTS public.desktop_sso_tickets;
