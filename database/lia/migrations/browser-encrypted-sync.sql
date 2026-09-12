-- Instancia: Lia / Hub (VITE_SUPABASE_URL), nunca SOFIA Learning ni IRIS.
-- Precondiciones: Supabase Auth con auth.users, auth.sessions, auth.uid()/jwt();
-- sesión Lia real del canje federado; ejecutar como propietario de migraciones.
-- Impacto: sólo tres tablas y funciones nuevas. No activa clientes ni transmite datos.
-- Idempotencia: DDL reejecutable, registro/revocación por dispositivo y recibos por escritura.
-- Reversión no destructiva: ../rollbacks/browser-encrypted-sync-disable.sql. Preservar backup antes de aplicar.
BEGIN;

DO $$ BEGIN
  IF to_regclass('auth.users') IS NULL OR to_regclass('auth.sessions') IS NULL
    OR to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('auth.jwt()') IS NULL THEN
    RAISE EXCEPTION 'Sync requiere Supabase Auth Lia con sesiones verificables.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.browser_sync_valid_envelope(value jsonb, category text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE raw text; decoded bytea; field text; size_limit integer;
BEGIN
  IF value IS NULL OR jsonb_typeof(value) <> 'object' OR category IS NULL
    OR category NOT IN ('bookmarks', 'groups', 'tabs', 'settings') THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(value)) <> 6
    OR value->'version' IS DISTINCT FROM '1'::jsonb
    OR value->>'algorithm' IS DISTINCT FROM 'aes-256-gcm'
    OR value->>'category' IS DISTINCT FROM category THEN RETURN false; END IF;
  FOREACH field IN ARRAY ARRAY['nonce', 'authTag', 'ciphertext'] LOOP
    IF jsonb_typeof(value->field) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
    raw := value->>field;
    size_limit := CASE field WHEN 'nonce' THEN 12 WHEN 'authTag' THEN 16 ELSE 2097152 END;
    IF length(raw) = 0 OR length(raw) > ((size_limit + 2) / 3) * 4 THEN RETURN false; END IF;
    decoded := decode(raw, 'base64');
    IF replace(encode(decoded, 'base64'), E'\n', '') <> raw
      OR octet_length(decoded) > size_limit
      OR (field <> 'ciphertext' AND octet_length(decoded) <> size_limit) THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN invalid_parameter_value OR invalid_text_representation THEN RETURN false;
END $$;

CREATE TABLE IF NOT EXISTS public.browser_sync_devices (
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL,
  auth_session_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  registration_trace_id uuid NOT NULL,
  revoked_at timestamptz,
  revocation_trace_id uuid,
  PRIMARY KEY (owner_user_id, device_id),
  UNIQUE (owner_user_id, auth_session_id),
  CHECK ((revoked_at IS NULL) = (revocation_trace_id IS NULL))
);
-- No FK a auth.sessions: su limpieza no debe borrar el registro de revocación
-- ni bloquear el logout. Cada acceso comprueba que la sesión aún exista.
CREATE TABLE IF NOT EXISTS public.browser_sync_envelopes (
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('bookmarks', 'groups', 'tabs', 'settings')),
  revision bigint NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  envelope jsonb NOT NULL,
  device_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, category),
  FOREIGN KEY (owner_user_id, device_id) REFERENCES public.browser_sync_devices(owner_user_id, device_id),
  CHECK (public.browser_sync_valid_envelope(envelope, category))
);
CREATE TABLE IF NOT EXISTS public.browser_sync_mutations (
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  trace_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('bookmarks', 'groups', 'tabs', 'settings')),
  device_id uuid NOT NULL,
  request_hash bytea NOT NULL CHECK (octet_length(request_hash) = 32),
  revision bigint NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, idempotency_key),
  FOREIGN KEY (owner_user_id, device_id) REFERENCES public.browser_sync_devices(owner_user_id, device_id)
);

CREATE INDEX IF NOT EXISTS browser_sync_envelopes_owner_updated_idx
  ON public.browser_sync_envelopes(owner_user_id, updated_at, category);

CREATE OR REPLACE FUNCTION public.browser_sync_actor_session()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid(); session_id uuid;
BEGIN
  session_id := (auth.jwt()->>'session_id')::uuid;
  IF actor IS NULL OR session_id IS NULL OR auth.jwt()->'is_anonymous' IS DISTINCT FROM 'false'::jsonb OR NOT EXISTS (
    SELECT 1 FROM auth.sessions s WHERE s.id = session_id AND s.user_id = actor
  ) THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Se requiere una sesión Lia vigente.'; END IF;
  RETURN session_id;
EXCEPTION WHEN invalid_text_representation THEN
  RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La sesión Lia no es válida.';
END $$;

CREATE OR REPLACE FUNCTION public.browser_sync_session_active()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_session uuid;
BEGIN
  current_session := public.browser_sync_actor_session();
  RETURN EXISTS (SELECT 1 FROM public.browser_sync_devices d
    WHERE d.owner_user_id = auth.uid() AND d.auth_session_id = current_session AND d.revoked_at IS NULL);
EXCEPTION WHEN insufficient_privilege THEN RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.browser_sync_register_device(p_device_id uuid, p_trace_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid(); current_session uuid; previous public.browser_sync_devices%ROWTYPE;
BEGIN
  current_session := public.browser_sync_actor_session();
  IF p_device_id IS NULL OR p_trace_id IS NULL THEN RAISE EXCEPTION 'Falta dispositivo o trazabilidad.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text, 73109));
  SELECT * INTO previous FROM public.browser_sync_devices d
    WHERE d.owner_user_id = actor AND d.auth_session_id = current_session;
  IF FOUND THEN
    IF previous.revoked_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El dispositivo está revocado. Inicia una sesión nueva.'; END IF;
    IF previous.device_id <> p_device_id THEN RAISE EXCEPTION 'La sesión ya está vinculada a otro dispositivo.'; END IF;
    RETURN previous.device_id;
  END IF;
  IF (SELECT count(*) FROM public.browser_sync_devices WHERE owner_user_id = actor) >= 100 THEN
    RAISE EXCEPTION 'Se alcanzó la cuota de dispositivos. No se borraron registros.';
  END IF;
  INSERT INTO public.browser_sync_devices(owner_user_id, device_id, auth_session_id, registration_trace_id)
    VALUES (actor, p_device_id, current_session, p_trace_id);
  RETURN p_device_id;
END $$;

CREATE OR REPLACE FUNCTION public.browser_sync_put(
  p_category text, p_envelope jsonb, p_expected_revision bigint, p_idempotency_key uuid, p_trace_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid(); current_session uuid; current_device uuid;
  previous_revision bigint; request_hash bytea; receipt public.browser_sync_mutations%ROWTYPE;
BEGIN
  current_session := public.browser_sync_actor_session();
  IF p_expected_revision IS NULL OR p_expected_revision < 0 OR p_expected_revision >= 9007199254740991
    OR p_idempotency_key IS NULL OR p_trace_id IS NULL
    OR NOT public.browser_sync_valid_envelope(p_envelope, p_category) THEN
    RAISE EXCEPTION 'La escritura cifrada no cumple el contrato.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text, 73109));
  SELECT device_id INTO current_device FROM public.browser_sync_devices
    WHERE owner_user_id = actor AND auth_session_id = current_session AND revoked_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El dispositivo no está autorizado para sincronizar.'; END IF;
  request_hash := sha256(convert_to(jsonb_build_array(current_device, p_category, p_expected_revision, p_envelope)::text, 'UTF8'));
  SELECT * INTO receipt FROM public.browser_sync_mutations
    WHERE owner_user_id = actor AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF receipt.request_hash <> request_hash THEN RAISE EXCEPTION 'La clave de idempotencia ya se usó con otra escritura.'; END IF;
    RETURN jsonb_build_object('status', 'replayed', 'revision', receipt.revision);
  END IF;
  SELECT revision INTO previous_revision FROM public.browser_sync_envelopes WHERE owner_user_id = actor AND category = p_category;
  previous_revision := coalesce(previous_revision, 0);
  IF previous_revision <> p_expected_revision THEN
    RETURN jsonb_build_object('status', 'conflict', 'revision', previous_revision);
  END IF;
  IF (SELECT count(*) FROM public.browser_sync_mutations WHERE owner_user_id = actor) >= 10000 THEN
    RAISE EXCEPTION 'Se alcanzó la cuota de recibos. No se borró la evidencia de idempotencia.';
  END IF;
  INSERT INTO public.browser_sync_envelopes(owner_user_id, category, revision, envelope, device_id)
    VALUES (actor, p_category, previous_revision + 1, p_envelope, current_device)
    ON CONFLICT (owner_user_id, category) DO UPDATE
      SET revision = excluded.revision, envelope = excluded.envelope, device_id = excluded.device_id, updated_at = now();
  INSERT INTO public.browser_sync_mutations(owner_user_id, idempotency_key, trace_id, category, device_id, request_hash, revision)
    VALUES (actor, p_idempotency_key, p_trace_id, p_category, current_device, request_hash, previous_revision + 1);
  RETURN jsonb_build_object('status', 'written', 'revision', previous_revision + 1);
END $$;

CREATE OR REPLACE FUNCTION public.browser_sync_revoke_device(p_device_id uuid, p_trace_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid(); current_session uuid;
BEGIN
  current_session := public.browser_sync_actor_session();
  IF p_device_id IS NULL OR p_trace_id IS NULL THEN RAISE EXCEPTION 'Falta dispositivo o trazabilidad.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text, 73109));
  -- Repetir la revocación propia es idempotente, sin habilitar otra operación.
  IF EXISTS (SELECT 1 FROM public.browser_sync_devices WHERE owner_user_id = actor
    AND device_id = p_device_id AND auth_session_id = current_session AND revoked_at IS NOT NULL) THEN RETURN true; END IF;
  IF NOT public.browser_sync_session_active() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El dispositivo no está autorizado para revocar.';
  END IF;
  UPDATE public.browser_sync_devices SET revoked_at = coalesce(revoked_at, now()),
    revocation_trace_id = coalesce(revocation_trace_id, p_trace_id)
    WHERE owner_user_id = actor AND device_id = p_device_id;
  RETURN FOUND;
END $$;

ALTER TABLE public.browser_sync_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.browser_sync_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.browser_sync_mutations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS browser_sync_devices_read_owner ON public.browser_sync_devices;
CREATE POLICY browser_sync_devices_read_owner ON public.browser_sync_devices FOR SELECT TO authenticated
  USING (owner_user_id = (SELECT auth.uid()) AND (SELECT public.browser_sync_session_active()));
DROP POLICY IF EXISTS browser_sync_envelopes_read_owner ON public.browser_sync_envelopes;
CREATE POLICY browser_sync_envelopes_read_owner ON public.browser_sync_envelopes FOR SELECT TO authenticated
  USING (owner_user_id = (SELECT auth.uid()) AND (SELECT public.browser_sync_session_active()));
-- Recibos internos y toda escritura directa: sin políticas = denegación por defecto.
REVOKE ALL ON public.browser_sync_devices, public.browser_sync_envelopes, public.browser_sync_mutations FROM PUBLIC, anon, authenticated;
GRANT SELECT(owner_user_id, device_id, created_at, revoked_at) ON public.browser_sync_devices TO authenticated;
GRANT SELECT ON public.browser_sync_envelopes TO authenticated;
REVOKE ALL ON FUNCTION public.browser_sync_valid_envelope(jsonb,text), public.browser_sync_actor_session(),
  public.browser_sync_session_active(), public.browser_sync_register_device(uuid,uuid),
  public.browser_sync_put(text,jsonb,bigint,uuid,uuid), public.browser_sync_revoke_device(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.browser_sync_session_active(), public.browser_sync_register_device(uuid,uuid),
  public.browser_sync_put(text,jsonb,bigint,uuid,uuid), public.browser_sync_revoke_device(uuid,uuid) TO authenticated;

COMMENT ON TABLE public.browser_sync_devices IS 'Dispositivos personales de Lia ligados a sesiones firmadas. Sin hostname, MAC, email ni claves E2EE.';
COMMENT ON TABLE public.browser_sync_envelopes IS 'Última instantánea opaca de cada categoría permitida. El servidor no posee claves de descifrado.';
COMMENT ON TABLE public.browser_sync_mutations IS 'Recibos sin contenido ni claves: idempotencia y trazabilidad. Sin lectura directa para clientes.';
COMMIT;
