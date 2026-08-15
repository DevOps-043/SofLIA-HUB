-- =====================================================================
-- Pulse Hub - Ajustes de cada Skill por usuario
-- EJECUTAR EN LA INSTANCIA SUPABASE DE PULSE HUB (VITE_SUPABASE_URL).
-- NO en IRIS ni en SOFIA Learning.
--
-- Consolida `user_skill_channels` y le anade dos ejes nuevos:
--   - `tools`: que herramientas puede usar el modelo con esa Skill.
--   - `web_search`: si busca en la web (auto | siempre | nunca).
--
-- Por que una sola tabla y no tres: la clave es identica en las tres
-- (`user_id`, `skill_id`) y el ciclo de vida tambien. Dos tablas con la
-- misma clave se consultarian siempre juntas y se desincronizarian al
-- borrar.
--
-- Asimetria deliberada, igual que en el resto del modelo: la AUSENCIA de
-- fila (o de columna) NO retira nada. Una Skill sin configurar sigue
-- viendo lo mismo que antes de que existiera esta pantalla. Solo una
-- lista declarada acota.
--
-- Frontera de privilegio: `tools` ACOTA, nunca amplia. El cliente
-- interseca con lo que la superficie ofrece y el canal autoriza
-- (`src/shared/skills/tool-selection.ts`), y las confirmaciones de las
-- operaciones destructivas siguen viviendo en el ejecutor. Que el usuario
-- marque `execute_command` no autoriza por adelantado lo que haga con el.
--
-- Idempotencia: IF NOT EXISTS en tabla, indice y politicas; la copia
-- desde `user_skill_channels` usa ON CONFLICT DO NOTHING.
--
-- Rollback: ver el bloque al final. `user_skill_channels` NO se borra
-- aqui: se conserva una version como red de seguridad.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_skill_settings (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id   text NOT NULL CHECK (length(btrim(skill_id)) > 0),
  -- Canales donde la Skill esta activa. Vacia = en ninguno (eleccion
  -- legitima y distinta de no tener fila).
  channels   text[] NOT NULL DEFAULT '{}'::text[],
  -- Herramientas seleccionadas. NULL = sin eleccion (todo lo que ofrezca
  -- la superficie). Array vacio = ninguna herramienta.
  tools      text[],
  web_search text NOT NULL DEFAULT 'auto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id),
  CONSTRAINT user_skill_settings_canales CHECK (
    channels <@ ARRAY['escritorio', 'whatsapp', 'telegram']::text[]
  ),
  CONSTRAINT user_skill_settings_busqueda CHECK (
    web_search IN ('auto', 'siempre', 'nunca')
  )
);

CREATE INDEX IF NOT EXISTS idx_user_skill_settings_usuario
  ON public.user_skill_settings(user_id);

COMMENT ON TABLE public.user_skill_settings IS
  'Ajustes de cada Skill por usuario: canales, herramientas y busqueda web. La ausencia de fila no retira nada.';
COMMENT ON COLUMN public.user_skill_settings.tools IS
  'NULL = sin eleccion (toda la superficie). Array vacio = ninguna. ACOTA, nunca amplia: el cliente interseca con la superficie y el canal.';
COMMENT ON COLUMN public.user_skill_settings.web_search IS
  'auto|siempre|nunca. No es una herramienta: el proveedor no permite combinar busqueda con function calling en una misma peticion.';

-- ---------------------------------------------------------------------
-- RLS: cada usuario ve y escribe solo lo suyo
-- ---------------------------------------------------------------------
ALTER TABLE public.user_skill_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_skill_settings' AND policyname='Usuarios leen sus ajustes de skills') THEN
    CREATE POLICY "Usuarios leen sus ajustes de skills"
      ON public.user_skill_settings FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_skill_settings' AND policyname='Usuarios crean sus ajustes de skills') THEN
    CREATE POLICY "Usuarios crean sus ajustes de skills"
      ON public.user_skill_settings FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_skill_settings' AND policyname='Usuarios actualizan sus ajustes de skills') THEN
    CREATE POLICY "Usuarios actualizan sus ajustes de skills"
      ON public.user_skill_settings FOR UPDATE TO authenticated
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_skill_settings' AND policyname='Usuarios eliminan sus ajustes de skills') THEN
    CREATE POLICY "Usuarios eliminan sus ajustes de skills"
      ON public.user_skill_settings FOR DELETE TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Copia desde `user_skill_channels`, si existe
--   Quien ya hubiera configurado canales no pierde nada.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_skill_channels') THEN
    INSERT INTO public.user_skill_settings (user_id, skill_id, channels, created_at, updated_at)
    SELECT user_id, skill_id, channels, created_at, updated_at
    FROM public.user_skill_channels
    ON CONFLICT (user_id, skill_id) DO NOTHING;
    RAISE NOTICE 'Canales copiados desde user_skill_channels.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Skills pasivas: herramientas y busqueda web propias
--   NULL en `tools` = hereda la seleccion de su Skill.
-- ---------------------------------------------------------------------
ALTER TABLE public.passive_skills
  ADD COLUMN IF NOT EXISTS tools text[],
  ADD COLUMN IF NOT EXISTS web_search text NOT NULL DEFAULT 'auto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema='public' AND table_name='passive_skills'
      AND constraint_name='passive_skills_busqueda'
  ) THEN
    ALTER TABLE public.passive_skills
      ADD CONSTRAINT passive_skills_busqueda CHECK (web_search IN ('auto', 'siempre', 'nunca'));
  END IF;
END $$;

COMMENT ON COLUMN public.passive_skills.tools IS
  'NULL = hereda la seleccion de su Skill. Una rutina desatendida es donde mas importa poder acotar por separado.';

-- ---------------------------------------------------------------------
-- Verificacion
-- ---------------------------------------------------------------------
-- Cuatro politicas, todas por auth.uid(), ninguna abierta a anon.
SELECT policyname, cmd FROM pg_policies
WHERE schemaname='public' AND tablename='user_skill_settings' ORDER BY cmd, policyname;

SELECT count(*) AS politicas_anonimas FROM pg_policies
WHERE schemaname='public' AND tablename='user_skill_settings' AND 'anon' = ANY(roles);

-- Las filas copiadas deben coincidir con las de la tabla anterior.
SELECT
  (SELECT count(*) FROM public.user_skill_settings) AS ajustes,
  (SELECT count(*) FROM information_schema.tables
   WHERE table_schema='public' AND table_name='user_skill_channels') AS tabla_anterior_existe;

-- Columnas nuevas en passive_skills.
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='passive_skills'
  AND column_name IN ('tools', 'web_search');

-- ---------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.user_skill_settings;
-- ALTER TABLE public.passive_skills DROP COLUMN IF EXISTS tools;
-- ALTER TABLE public.passive_skills DROP COLUMN IF EXISTS web_search;
