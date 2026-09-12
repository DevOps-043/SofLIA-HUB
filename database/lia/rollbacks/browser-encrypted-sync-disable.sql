-- Lia: rollback operativo manual, NO destructivo; no forma parte de la aplicación de migraciones.
-- Preflight: detener clientes y respaldar las tres tablas antes de ejecutar.
-- Sólo revoca accesos nuevos; conserva ciphertext, revisiones y revocaciones.
-- Idempotente. Reaplicar browser-encrypted-sync.sql restaura permisos sin borrar datos.
-- No ejecutar remotamente sin autorización. No detiene consultas ya iniciadas.
BEGIN;
REVOKE ALL ON public.browser_sync_devices, public.browser_sync_envelopes, public.browser_sync_mutations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.browser_sync_valid_envelope(jsonb,text), public.browser_sync_actor_session(),
  public.browser_sync_session_active(), public.browser_sync_register_device(uuid,uuid),
  public.browser_sync_put(text,jsonb,bigint,uuid,uuid), public.browser_sync_revoke_device(uuid,uuid) FROM PUBLIC, anon, authenticated;
-- Los grants de columna son independientes de los de tabla.
REVOKE SELECT(owner_user_id, device_id, created_at, revoked_at) ON public.browser_sync_devices FROM authenticated;
COMMIT;
