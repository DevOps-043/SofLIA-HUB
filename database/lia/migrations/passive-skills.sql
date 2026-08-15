-- =====================================================================
-- Pulse Hub - Skills pasivas por usuario y por perfil
-- EJECUTAR EN LA INSTANCIA SUPABASE DE PULSE HUB (VITE_SUPABASE_URL).
-- NO en IRIS ni en SOFIA Learning.
--
-- Contexto: las Skills pasivas (las rutinas programadas) vivian en un
-- JSON local espejado en `hub_service_state` bajo UNA SOLA FILA global
-- (`service_name = 'task-scheduler'`), sin `user_id` y con una politica
-- permisiva `TO anon, authenticated USING (true)`. Consecuencias reales:
--   - Dos usuarios de la misma base compartian esa fila y la ultima
--     escritura ganaba: uno podia pisar las rutinas del otro.
--   - Cualquiera con la clave anonima leia los prompts de todos.
--   - Cambiar de equipo o formatear obligaba a recrearlas.
--
-- Esta tabla les da dueno. El JSON local se conserva, pero degradado a
-- CACHE DE ARRANQUE: node-cron tiene que levantar las programaciones sin
-- depender de la red, y una rutina que no se ejecuta no avisa de que no
-- se ejecuto. Cuando la base responde, lo que dice manda.
--
-- Requisito: el proceso main debe operar CON SESION para que auth.uid()
-- resuelva (ver `electron/main/hub-session.ts`). Sin sesion su rol es
-- `anon` y estas politicas le devuelven cero filas.
--
-- Idempotencia: IF NOT EXISTS en tabla, indices y politicas.
-- Rollback: ver el bloque al final; el espejo global sigue intacto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabla
--    `id` es el identificador que ya usa el planificador local, no un
--    uuid nuevo: es lo que hace idempotente la migracion desde el
--    espejo global y lo que permite correlacionar cron y fila.
--    `profile` es el perfil de canal ('global' o el telefono del
--    contacto): la interfaz lista por perfil y sin esta columna habria
--    que filtrar en cliente sobre todas las reglas del usuario.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.passive_skills (
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id              text NOT NULL CHECK (length(btrim(id)) > 0),
  profile         text NOT NULL DEFAULT 'global',
  -- Skill del catalogo que ejecuta. Nulo = rutina libre.
  skill_id        text,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  description     text,
  prompt          text NOT NULL CHECK (length(btrim(prompt)) > 0),
  cron_expression text NOT NULL CHECK (length(btrim(cron_expression)) > 0),
  schedule_label  text,
  -- Canales de entrega. Vacio no es valido: una regla sin destino se
  -- ejecutaria en silencio y el usuario nunca sabria que corrio.
  channels        text[] NOT NULL DEFAULT '{}'::text[],
  run_once        boolean NOT NULL DEFAULT false,
  scheduled_for   timestamptz,
  phone_number    text,
  source          text NOT NULL DEFAULT 'app',
  requested_by    text,
  last_run_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  CONSTRAINT passive_skills_canales_validos CHECK (
    channels <@ ARRAY['escritorio', 'whatsapp', 'telegram']::text[]
    AND array_length(channels, 1) >= 1
  ),
  CONSTRAINT passive_skills_source_valido CHECK (source IN ('legacy', 'chat', 'app'))
);

CREATE INDEX IF NOT EXISTS idx_passive_skills_usuario_perfil
  ON public.passive_skills(user_id, profile);

COMMENT ON TABLE public.passive_skills IS
  'Skills pasivas (rutinas programadas) por usuario y perfil de canal. Fuente de verdad; el JSON local del planificador es solo cache de arranque.';
COMMENT ON COLUMN public.passive_skills.id IS
  'Identificador del planificador local, no un uuid nuevo: hace idempotente la migracion desde hub_service_state y correlaciona la fila con su cron.';
COMMENT ON COLUMN public.passive_skills.profile IS
  'Perfil de canal: "global" o el telefono del contacto al que pertenece la rutina.';
COMMENT ON COLUMN public.passive_skills.channels IS
  'Subconjunto no vacio de escritorio/whatsapp/telegram por donde se entrega el resultado.';

-- ---------------------------------------------------------------------
-- 2. RLS: cada usuario ve y escribe solo lo suyo
--    Es la guarda que sustituye a la fila global compartida. Sin ella,
--    esta tabla no mejoraria nada respecto a `hub_service_state`.
-- ---------------------------------------------------------------------
ALTER TABLE public.passive_skills ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'passive_skills'
      AND policyname = 'Usuarios leen sus skills pasivas'
  ) THEN
    CREATE POLICY "Usuarios leen sus skills pasivas"
      ON public.passive_skills FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'passive_skills'
      AND policyname = 'Usuarios crean sus skills pasivas'
  ) THEN
    CREATE POLICY "Usuarios crean sus skills pasivas"
      ON public.passive_skills FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'passive_skills'
      AND policyname = 'Usuarios actualizan sus skills pasivas'
  ) THEN
    CREATE POLICY "Usuarios actualizan sus skills pasivas"
      ON public.passive_skills FOR UPDATE TO authenticated
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'passive_skills'
      AND policyname = 'Usuarios eliminan sus skills pasivas'
  ) THEN
    CREATE POLICY "Usuarios eliminan sus skills pasivas"
      ON public.passive_skills FOR DELETE TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. Verificacion
-- ---------------------------------------------------------------------
-- Deben aparecer exactamente cuatro politicas, todas acotadas por auth.uid().
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'passive_skills'
ORDER BY cmd, policyname;

-- Debe devolver 0: ninguna politica abierta a `anon`.
SELECT count(*) AS politicas_anonimas FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'passive_skills'
  AND 'anon' = ANY(roles);

-- Debe devolver true: RLS habilitada.
SELECT relrowsecurity AS rls_habilitada
FROM pg_class WHERE oid = 'public.passive_skills'::regclass;

-- Reparto por usuario y perfil. Vacio recien migrado.
SELECT user_id, profile, count(*) AS reglas
FROM public.passive_skills
GROUP BY user_id, profile ORDER BY user_id, profile;

-- Reglas que quedan en el espejo global sin migrar (deberia bajar a 0 a
-- medida que cada usuario inicia sesion).
SELECT jsonb_array_length(state_json) AS reglas_en_espejo_global
FROM public.hub_service_state WHERE service_name = 'task-scheduler';

-- ---------------------------------------------------------------------
-- ROLLBACK (ejecutar solo si hay que volver al espejo global)
-- ---------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.passive_skills;
