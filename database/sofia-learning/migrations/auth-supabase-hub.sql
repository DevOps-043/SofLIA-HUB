-- =============================================================================
-- Diagnóstico de identidad del Hub sobre Supabase Auth — Consultas de soporte
-- =============================================================================
-- Proyecto Supabase: SofLIA-Learning (mrqnnmuckznvukjvfkly)
-- Instancia propietaria: SOFIA. NO ejecutar en Pulse Hub/Lia ni en IRIS.
-- Precondición: public.users pertenece al proyecto SofLIA-Learning/SOFIA.
-- Impacto: todas las consultas son de solo lectura; no inspeccionan hashes.
-- Idempotencia: las consultas de lectura pueden repetirse sin mutar datos.
-- Contexto completo: docs/operations/auth-migration.md
-- =============================================================================


-- Guarda de instancia. Detiene el lote con un mensaje accionable antes de que
-- PostgreSQL llegue a las consultas de public.users.
DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Instancia incorrecta: este diagnóstico pertenece a SofLIA-Learning/SOFIA.',
      HINT = 'Abre el proyecto Supabase de SofLIA Learning. No lo ejecutes en Pulse Hub/Lia ni en IRIS.';
  ELSIF (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name IN ('id', 'email', 'email_verified', 'email_verified_at')
  ) <> 4 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Esquema SOFIA incompatible con este diagnóstico.',
      HINT = 'Actualiza el snapshot o revisa las columnas actuales de public.users; no agregues columnas de credenciales.';
  END IF;
END
$$;


-- =============================================================================
-- SECCIÓN 1 — Correspondencia actual entre perfil y Supabase Auth (solo lectura)
-- No consulta ni expone hashes de contraseña.
-- =============================================================================
SELECT
  u.id AS public_user_id,
  au.id AS auth_user_id,
  u.username,
  u.email AS public_email,
  au.email AS auth_email,
  au.id IS NOT NULL AS existe_en_auth,
  au.email_confirmed_at IS NOT NULL AS email_confirmado_en_auth,
  au.last_sign_in_at,
  CASE
    WHEN au.id IS NULL THEN 'sin_usuario_auth_del_mismo_uuid'
    WHEN lower(au.email) IS DISTINCT FROM lower(u.email) THEN 'revision_manual_email_distinto'
    WHEN au.email_confirmed_at IS NULL THEN 'confirmacion_auth_incompleta'
    ELSE 'identidad_consistente'
  END AS diagnostico_identidad
FROM public.users u
LEFT JOIN auth.users au ON au.id = u.id
ORDER BY diagnostico_identidad, u.email;


-- =============================================================================
-- SECCIÓN 2 — Perfiles sin identidad Auth del mismo UUID (solo lectura)
-- Una coincidencia por correo con UUID distinto requiere conciliación manual.
-- =============================================================================
SELECT
  u.id AS public_user_id,
  u.username,
  u.email AS public_email,
  auth_by_email.id AS auth_user_same_email_id,
  CASE
    WHEN auth_by_email.id IS NULL THEN 'sin_usuario_auth'
    ELSE 'revision_manual_uuid_distinto'
  END AS diagnostico_identidad
FROM public.users u
LEFT JOIN auth.users auth_by_id ON auth_by_id.id = u.id
LEFT JOIN auth.users auth_by_email ON lower(auth_by_email.email) = lower(u.email)
WHERE auth_by_id.id IS NULL
ORDER BY u.email;


-- =============================================================================
-- SECCIÓN 2B — Confirmación incompleta en cuentas migradas (solo lectura)
-- Detecta usuarios que pueden iniciar sesión pero no tienen la marca de correo
-- confirmado en Auth. La federación solo admite el fallback legado cuando UUID
-- y correo coinciden y public.users conserva booleano + fecha de verificación.
-- No usar last_sign_in_at como prueba de propiedad del correo.
-- =============================================================================
SELECT
  profile_by_id.id AS public_user_id,
  au.id AS auth_user_id,
  profile_by_id.username,
  profile_by_id.email AS public_email,
  au.email AS auth_email,
  profile_by_id.email_verified,
  profile_by_id.email_verified_at,
  au.email_confirmed_at,
  au.last_sign_in_at,
  CASE
    WHEN profile_by_id.id IS NULL AND profile_by_email.id IS NOT NULL
      THEN 'revision_manual_uuid_distinto'
    WHEN profile_by_id.id IS NULL THEN 'revision_manual_sin_perfil'
    WHEN lower(au.email) IS DISTINCT FROM lower(profile_by_id.email)
      THEN 'revision_manual_email_distinto'
    WHEN profile_by_id.email_verified IS TRUE AND profile_by_id.email_verified_at IS NOT NULL
      THEN 'compatible_fallback_legado'
    ELSE 'revision_manual_sin_evidencia_completa'
  END AS diagnostico_federacion
FROM auth.users au
LEFT JOIN public.users profile_by_id ON profile_by_id.id = au.id
LEFT JOIN public.users profile_by_email ON lower(profile_by_email.email) = lower(au.email)
WHERE au.email_confirmed_at IS NULL
  AND au.last_sign_in_at IS NOT NULL
ORDER BY diagnostico_federacion, au.email;
