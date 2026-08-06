-- Instancia: Pulse Hub / Lia (VITE_SUPABASE_URL).
-- Objetivo: diagnosticar, sin modificar datos, la identidad operativa que usa
--           una cuenta SOFIA para acceder a sus conversaciones.
-- Precondiciones: ejecutar como operador autorizado en el SQL Editor del
--                 proyecto Pulse Hub/Lia, no en SofLIA Learning/SOFIA.
-- Impacto: solo lectura. No crea usuarios, sesiones, perfiles ni conversaciones.
-- Idempotencia: puede repetirse sin efectos.
--
-- Antes de ejecutar, reemplace los dos valores de `parametros` con el UUID y
-- correo que devolvio el diagnostico SOFIA para la misma persona.

DO $$
DECLARE
  relaciones_faltantes text;
BEGIN
  SELECT string_agg(relacion, ', ' ORDER BY relacion)
  INTO relaciones_faltantes
  FROM (
    VALUES
      ('auth.users'),
      ('public.profiles'),
      ('public.conversations')
  ) AS requeridas(relacion)
  WHERE to_regclass(relacion) IS NULL;

  IF relaciones_faltantes IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = format(
        'Este diagnostico debe ejecutarse en el proyecto Pulse Hub/Lia. Faltan: %s. Cambie de proyecto; no cree estas tablas en SOFIA.',
        relaciones_faltantes
      );
  END IF;
END $$;

WITH parametros AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS sofia_user_id,
    lower('REEMPLAZAR_CON_CORREO_SOFIA') AS sofia_email
),
coincidencias AS (
  SELECT
    'uuid_sofia'::text AS criterio,
    p.sofia_user_id,
    p.sofia_email,
    u.id AS lia_user_id,
    u.email AS lia_email,
    u.email_confirmed_at,
    u.created_at AS lia_created_at,
    u.last_sign_in_at AS lia_last_sign_in_at
  FROM parametros p
  LEFT JOIN auth.users u ON u.id = p.sofia_user_id

  UNION ALL

  SELECT
    'correo_sofia'::text AS criterio,
    p.sofia_user_id,
    p.sofia_email,
    u.id AS lia_user_id,
    u.email AS lia_email,
    u.email_confirmed_at,
    u.created_at AS lia_created_at,
    u.last_sign_in_at AS lia_last_sign_in_at
  FROM parametros p
  LEFT JOIN auth.users u ON lower(u.email) = p.sofia_email
)
SELECT
  c.criterio,
  c.sofia_user_id,
  c.sofia_email,
  c.lia_user_id,
  c.lia_email,
  c.email_confirmed_at IS NOT NULL AS email_confirmado_en_lia,
  c.lia_created_at,
  c.lia_last_sign_in_at,
  p.id AS profile_id,
  p.username AS profile_username,
  p.email AS profile_email,
  (SELECT count(*) FROM public.conversations cv WHERE cv.user_id = c.lia_user_id) AS conversaciones,
  (SELECT max(cv.updated_at) FROM public.conversations cv WHERE cv.user_id = c.lia_user_id) AS ultima_conversacion,
  (
    SELECT cls.relrowsecurity
    FROM pg_class cls
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    WHERE ns.nspname = 'public' AND cls.relname = 'conversations'
  ) AS rls_conversaciones_habilitado,
  (
    SELECT count(*)
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
      AND pol.tablename = 'conversations'
      AND pol.cmd IN ('SELECT', 'ALL')
  ) AS politicas_select_conversaciones,
  CASE
    WHEN c.sofia_user_id = '00000000-0000-0000-0000-000000000000'::uuid
      OR c.sofia_email = lower('REEMPLAZAR_CON_CORREO_SOFIA')
      THEN 'parametros_sin_reemplazar'
    WHEN c.lia_user_id IS NULL THEN 'sin_coincidencia_en_auth_lia'
    WHEN c.criterio = 'uuid_sofia' AND lower(c.lia_email) IS DISTINCT FROM c.sofia_email
      THEN 'mismo_uuid_con_correo_distinto'
    WHEN c.criterio = 'correo_sofia' AND c.lia_user_id IS DISTINCT FROM c.sofia_user_id
      THEN 'mismo_correo_con_uuid_distinto'
    WHEN c.email_confirmed_at IS NULL THEN 'correo_lia_sin_confirmar'
    WHEN p.id IS NULL THEN 'auth_lia_sin_perfil'
    ELSE 'identidad_operativa_consistente'
  END AS diagnostico
FROM coincidencias c
LEFT JOIN public.profiles p ON p.id = c.lia_user_id
ORDER BY c.criterio DESC;
