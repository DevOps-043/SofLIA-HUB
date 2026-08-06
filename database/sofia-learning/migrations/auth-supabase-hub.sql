-- =============================================================================
-- Migración del login de SofLIA Hub a Supabase Auth — Queries de soporte
-- =============================================================================
-- Proyecto Supabase: SofLIA-Learning (mrqnnmuckznvukjvfkly)
-- Contexto completo: docs/MIGRACION-AUTH-SUPABASE-HUB.md
--
-- SECCIÓN 1 y 2: solo lectura, EJECUTAR AHORA sin riesgo.
-- SECCIÓN 3: limpieza destructiva, NO EJECUTAR hasta que Learning confirme
--            que tampoco usa los RPCs (está comentada a propósito).
-- =============================================================================


-- =============================================================================
-- SECCIÓN 1 — Diagnóstico general (solo lectura)
-- Estado del hash legacy vs presencia en Supabase Auth, por usuario.
-- =============================================================================
SELECT
  u.username,
  u.email,
  CASE
    WHEN u.password_hash IS NULL THEN 'NULL (usuario nacido en Supabase Auth)'
    WHEN u.password_hash LIKE '$2b$%' THEN '$2b$ legacy JS-bcrypt (columna muerta)'
    WHEN u.password_hash LIKE '$2a$%' THEN '$2a$ legacy pgcrypto (columna muerta)'
    ELSE 'otro'
  END AS hash_legacy,
  au.encrypted_password IS NOT NULL AS tiene_password_en_auth,
  au.email_confirmed_at IS NOT NULL AS email_confirmado,
  au.last_sign_in_at
FROM public.users u
LEFT JOIN auth.users au ON lower(au.email) = lower(u.email)
ORDER BY tiene_password_en_auth, u.email;


-- =============================================================================
-- SECCIÓN 2 — Cuentas huérfanas (solo lectura) ← EJECUTA ESTA
-- Cuentas que NO pueden iniciar sesión en NINGÚN sistema (ni Learning ni Hub)
-- porque no existen en auth.users o no tienen contraseña ahí.
-- Resultado esperado según diagnóstico del 2026-07-08: solo
-- ernesto.hernandez@soflia.ai (ese usuario ya entra con su cuenta
-- @ecosdeliderazgo.com, así que probablemente no requiera acción).
-- Si aparece alguien más: Dashboard → Authentication → Users → ⋮ →
-- "Send password recovery" (NO es un cambio de contraseña para usuarios normales).
-- =============================================================================
SELECT
  u.username,
  u.email,
  CASE
    WHEN au.id IS NULL THEN 'No existe en auth.users'
    ELSE 'Existe en auth.users pero sin contraseña'
  END AS problema
FROM public.users u
LEFT JOIN auth.users au ON lower(au.email) = lower(u.email)
WHERE au.id IS NULL OR au.encrypted_password IS NULL
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
    WHEN lower(au.email) <> lower(profile_by_id.email)
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


-- =============================================================================
-- SECCIÓN 3 — Limpieza futura ⛔ NO EJECUTAR TODAVÍA
-- Requisitos previos:
--   a) El Hub con la migración desplegado y validado en producción.
--   b) SofLIA Learning confirma que NO llama a estos RPCs
--      (revisar logs de PostgREST unos días).
-- Ejecutar en este orden, un paso por release:
-- =============================================================================

-- Paso 1: retirar los RPCs legacy de pgcrypto.
-- DROP FUNCTION IF EXISTS public.authenticate_user(text, text);
-- DROP FUNCTION IF EXISTS public.change_user_password(uuid, text);
-- DROP FUNCTION IF EXISTS public.change_own_password(uuid, text, text);

-- Paso 2: vaciar la columna obsoleta (elimina el almacenamiento duplicado de
-- credenciales; mantener la columna un ciclo por si hay rollback).
-- UPDATE public.users SET password_hash = NULL;

-- Paso 3 (release posterior): eliminar la columna definitivamente.
-- ALTER TABLE public.users DROP COLUMN password_hash;
