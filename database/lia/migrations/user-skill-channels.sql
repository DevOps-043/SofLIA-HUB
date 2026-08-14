-- =====================================================================
-- Pulse Hub - Canales activos de cada Skill, por usuario
-- EJECUTAR EN LA INSTANCIA SUPABASE DE PULSE HUB (VITE_SUPABASE_URL).
-- NO en IRIS ni en SOFIA Learning.
--
-- Contexto: al unificarse Flujos de Trabajo y Skills, el usuario decide
-- donde vive cada capacidad: en su computadora (orbe y chat del Hub), en
-- WhatsApp, en Telegram, o en varios a la vez. Una Skill pasiva usa la
-- misma tabla para saber por donde entregar su resultado.
--
-- Por que en la base y no en el estado local: la eleccion la hace el
-- usuario en el Hub, pero la tienen que respetar el agente de WhatsApp y
-- el de Telegram, que corren en el proceso main y resuelven identidad por
-- numero de telefono o chat id, no por sesion del renderer. Un archivo en
-- userData no cruza esa frontera, y duplicarlo en los dos lados los haria
-- divergir. Es el mismo motivo por el que el catalogo del sistema ya vive
-- en la base.
--
-- Asimetria deliberada: la AUSENCIA de fila NO retira ningun canal. Una
-- Skill sin fila esta activa en todos los canales que declara su
-- catalogo. Solo una fila con la lista recortada retira canales. Es la
-- misma regla que gobierna el catalogo del sistema, y por la misma razon:
-- un fallo de lectura no puede dejar al usuario sin sus capacidades.
--
-- Idempotencia: IF NOT EXISTS en tabla, indice y politicas.
--
-- Rollback: ver el bloque al final. Al caer la tabla, el producto vuelve
-- a resolver por catalogo, que es el comportamiento por defecto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabla
--    La clave es (user_id, skill_id): una fila por Skill configurada.
--    `skill_id` es texto y NO tiene clave foranea a proposito: apunta
--    tanto a una Skill del sistema ('sistema:...') como a una del usuario
--    (uuid de public.skills), y las dos viven en tablas distintas.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_skill_channels (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id   text NOT NULL CHECK (length(btrim(skill_id)) > 0),
  -- Lista de canales activos. Vacia significa "en ninguno", que es una
  -- eleccion legitima y distinta de no tener fila.
  channels   text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id),
  -- El cliente vuelve a validar cada valor al leer: una version posterior
  -- puede introducir canales que esta todavia no entiende, y una fila
  -- escrita por aquella no puede romper a esta.
  CONSTRAINT user_skill_channels_valores CHECK (
    channels <@ ARRAY['escritorio', 'whatsapp', 'telegram']::text[]
  )
);

CREATE INDEX IF NOT EXISTS idx_user_skill_channels_usuario
  ON public.user_skill_channels(user_id);

COMMENT ON TABLE public.user_skill_channels IS
  'Canales en los que cada usuario tiene activa cada Skill. La ausencia de fila NO retira canales: la Skill queda activa en todos los que declara su catalogo.';
COMMENT ON COLUMN public.user_skill_channels.channels IS
  'Subconjunto de escritorio/whatsapp/telegram. Acota lo que el catalogo declara; nunca lo amplia. Lista vacia = activa en ninguno.';

-- ---------------------------------------------------------------------
-- 2. RLS: cada usuario ve y escribe solo lo suyo
--    Sin esto, una sola cuenta comprometida podria apagar las Skills de
--    cualquier otro usuario, o encenderlas en un canal que no controla.
-- ---------------------------------------------------------------------
ALTER TABLE public.user_skill_channels ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_skill_channels'
      AND policyname = 'Usuarios leen sus canales'
  ) THEN
    CREATE POLICY "Usuarios leen sus canales"
      ON public.user_skill_channels FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_skill_channels'
      AND policyname = 'Usuarios crean sus canales'
  ) THEN
    CREATE POLICY "Usuarios crean sus canales"
      ON public.user_skill_channels FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_skill_channels'
      AND policyname = 'Usuarios actualizan sus canales'
  ) THEN
    CREATE POLICY "Usuarios actualizan sus canales"
      ON public.user_skill_channels FOR UPDATE TO authenticated
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_skill_channels'
      AND policyname = 'Usuarios eliminan sus canales'
  ) THEN
    CREATE POLICY "Usuarios eliminan sus canales"
      ON public.user_skill_channels FOR DELETE TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. Verificacion
-- ---------------------------------------------------------------------
-- Deben aparecer exactamente cuatro politicas, todas acotadas por auth.uid().
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_skill_channels'
ORDER BY cmd, policyname;

-- Debe devolver true: RLS habilitada.
SELECT relrowsecurity AS rls_habilitada
FROM pg_class WHERE oid = 'public.user_skill_channels'::regclass;

-- Reparto de configuraciones por usuario. Vacio recien migrado.
SELECT user_id, count(*) AS skills_configuradas
FROM public.user_skill_channels
GROUP BY user_id ORDER BY user_id;

-- ---------------------------------------------------------------------
-- ROLLBACK (ejecutar solo si hay que volver a resolver solo por catalogo)
-- ---------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.user_skill_channels;
