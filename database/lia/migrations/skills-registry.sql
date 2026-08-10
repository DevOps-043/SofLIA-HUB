-- =====================================================================
-- Pulse Hub - Registro de Skills (migracion de user_tools -> skills)
-- EJECUTAR EN LA INSTANCIA SUPABASE DE PULSE HUB (VITE_SUPABASE_URL).
-- NO en IRIS ni en SOFIA Learning.
--
-- Contexto: "flujos activos" (WhatsApp) y "herramientas del usuario"
-- (chat del Hub) resolvian el mismo problema con dos modelos que no se
-- podian invocar entre superficies. Este cambio unifica el concepto en
-- Skill. Las Skills del SISTEMA se declaran en codigo (versionadas, con
-- herramientas asociadas); esta tabla guarda unicamente las Skills del
-- USUARIO, que solo aportan instrucciones y prompts de inicio.
--
-- Por que no hay columna is_system: la frontera de privilegio no puede
-- vivir en un booleano escribible. Una fila de esta tabla nunca es una
-- Skill del sistema, la clase se deriva de la fuente.
--
-- Precondiciones: existe public.user_tools con las columnas originales
-- (id, user_id, name, description, icon, category, system_prompt,
-- starter_prompts, is_favorite, usage_count, created_at, updated_at).
--
-- Idempotencia: todo el script usa IF NOT EXISTS / ON CONFLICT y puede
-- ejecutarse varias veces con el mismo resultado.
--
-- Impacto: crea public.skills, migra las filas de user_tools y sustituye
-- user_tools por una VISTA de compatibilidad de solo lectura. La vista es
-- lo que permite revertir el renderer sin revertir datos; su eliminacion
-- es un paso posterior, fuera de esta migracion.
--
-- Rollback: ver el bloque ROLLBACK al final del archivo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Conteo previo (evidencia para verification.md).
--    Ejecutar y guardar el resultado ANTES de continuar.
-- ---------------------------------------------------------------------
-- SELECT user_id, count(*) AS herramientas FROM public.user_tools GROUP BY user_id ORDER BY user_id;

-- ---------------------------------------------------------------------
-- 1. Tabla de Skills del usuario
--    `instructions` sustituye a `system_prompt`: el nombre viejo sugeria
--    que el usuario escribia el prompt de sistema del agente, cuando en
--    realidad solo aporta instrucciones que se anexan al prompt base.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  description text,
  -- Identificador del icono (ver src/components/skill-library/skill-icons.tsx),
  -- no un emoji: un glifo depende de la fuente del equipo y se ve distinto en
  -- cada uno; un trazo SVG se ve igual y hereda el color del tema.
  icon text NOT NULL DEFAULT 'herramienta',
  -- Comando de invocacion con `/`, sin la barra. El usuario lo configura; si
  -- lo deja vacio, la interfaz lo deriva del nombre.
  command text,
  category text,
  instructions text NOT NULL CHECK (length(btrim(instructions)) > 0),
  starter_prompts jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_favorite boolean NOT NULL DEFAULT false,
  usage_count integer NOT NULL DEFAULT 0,
  -- Trazabilidad de la migracion: identifica la fila de user_tools de
  -- origen y hace idempotente la copia (ON CONFLICT sobre este indice).
  migrated_from_user_tool_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skills_user ON public.skills(user_id);
CREATE INDEX IF NOT EXISTS idx_skills_user_orden
  ON public.skills(user_id, is_favorite DESC, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_migracion
  ON public.skills(migrated_from_user_tool_id)
  WHERE migrated_from_user_tool_id IS NOT NULL;

-- Un usuario no puede tener dos skills con el mismo comando: `/informe` debe
-- resolver siempre a la misma. Parcial porque el comando es opcional.
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_comando
  ON public.skills(user_id, command)
  WHERE command IS NOT NULL;

-- ---------------------------------------------------------------------
-- 1b. Columnas anadidas despues de la primera version de esta migracion.
--     Se declaran aparte para que una base donde ya se creo la tabla las
--     reciba igualmente al volver a ejecutar el script.
-- ---------------------------------------------------------------------
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS command text;

-- Las skills migradas desde user_tools traen un emoji en `icon`. Se
-- normalizan al icono por defecto: la interfaz ya no dibuja glifos.
UPDATE public.skills
SET icon = 'herramienta'
WHERE icon !~ '^[a-z]+$';

COMMENT ON TABLE public.skills IS
  'Skills creadas por el usuario. Solo instrucciones y prompts de inicio: nunca declaran herramientas privilegiadas. Las Skills del sistema se declaran en codigo, no aqui.';

-- ---------------------------------------------------------------------
-- 2. RLS de propietario
--    El chat del Hub consulta esta tabla desde el renderer, que si tiene
--    sesion de Supabase Auth, por lo que auth.uid() es fiable aqui.
-- ---------------------------------------------------------------------
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'skills'
      AND policyname = 'Usuarios leen sus skills'
  ) THEN
    CREATE POLICY "Usuarios leen sus skills"
      ON public.skills FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'skills'
      AND policyname = 'Usuarios crean sus skills'
  ) THEN
    CREATE POLICY "Usuarios crean sus skills"
      ON public.skills FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'skills'
      AND policyname = 'Usuarios actualizan sus skills'
  ) THEN
    CREATE POLICY "Usuarios actualizan sus skills"
      ON public.skills FOR UPDATE TO authenticated
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'skills'
      AND policyname = 'Usuarios eliminan sus skills'
  ) THEN
    CREATE POLICY "Usuarios eliminan sus skills"
      ON public.skills FOR DELETE TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. Copia de datos desde user_tools
--    Solo corre mientras user_tools siga siendo TABLA. En la segunda
--    ejecucion ya es una vista sobre skills y el bloque se omite, lo que
--    evita que la copia se retroalimente.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  filas_origen bigint;
  filas_copiadas bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_tools'
      AND table_type = 'BASE TABLE'
  ) THEN
    RAISE NOTICE 'user_tools ya no es una tabla base: copia omitida (migracion ya aplicada).';
    RETURN;
  END IF;

  SELECT count(*) INTO filas_origen FROM public.user_tools;

  INSERT INTO public.skills (
    user_id, name, description, icon, category, instructions,
    starter_prompts, is_favorite, usage_count,
    migrated_from_user_tool_id, created_at, updated_at
  )
  SELECT
    t.user_id,
    t.name,
    t.description,
    -- El emoji de la herramienta original no se conserva: el catalogo de
    -- iconos es cerrado y el usuario elige el suyo desde la configuracion.
    'herramienta',
    -- category es un enum en user_tools; se guarda como texto libre para
    -- no acoplar el catalogo de Skills a un tipo de la instancia.
    NULLIF(t.category::text, ''),
    t.system_prompt,
    COALESCE(t.starter_prompts, '[]'::jsonb),
    COALESCE(t.is_favorite, false),
    COALESCE(t.usage_count, 0),
    t.id,
    COALESCE(t.created_at, now()),
    COALESCE(t.updated_at, now())
  FROM public.user_tools t
  WHERE btrim(COALESCE(t.name, '')) <> ''
    AND btrim(COALESCE(t.system_prompt, '')) <> ''
  -- El indice de trazabilidad es PARCIAL (solo filas con origen). Postgres
  -- solo lo infiere si el ON CONFLICT repite el mismo predicado; sin el
  -- falla con 42P10 "no unique or exclusion constraint matching".
  ON CONFLICT (migrated_from_user_tool_id) WHERE migrated_from_user_tool_id IS NOT NULL
  DO NOTHING;

  SELECT count(*) INTO filas_copiadas
  FROM public.skills WHERE migrated_from_user_tool_id IS NOT NULL;

  RAISE NOTICE 'user_tools: % filas; skills migradas: %.', filas_origen, filas_copiadas;

  IF filas_copiadas < filas_origen THEN
    RAISE WARNING 'Hay % filas de user_tools sin migrar (nombre o prompt vacios). Revisar antes de eliminar la tabla.',
      filas_origen - filas_copiadas;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4. Vista de compatibilidad
--    Un renderer anterior a este cambio sigue leyendo public.user_tools.
--    La tabla original se conserva renombrada durante una release para
--    poder revertir sin perdida; la vista la sustituye en su nombre.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_tools'
      AND table_type = 'BASE TABLE'
  ) THEN
    ALTER TABLE public.user_tools RENAME TO user_tools_legacy;
    RAISE NOTICE 'public.user_tools renombrada a public.user_tools_legacy (respaldo).';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.user_tools
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.user_id,
  s.name,
  s.description,
  s.icon,
  s.category,
  s.instructions AS system_prompt,
  s.starter_prompts,
  s.is_favorite,
  s.usage_count,
  s.created_at,
  s.updated_at
FROM public.skills s;

COMMENT ON VIEW public.user_tools IS
  'Vista de compatibilidad de solo lectura sobre public.skills. Existe para permitir revertir el renderer sin revertir datos. Eliminar en una release posterior.';

-- ---------------------------------------------------------------------
-- 5. Verificacion
-- ---------------------------------------------------------------------
-- Columnas: deben aparecer `command` e `icon` con el default nuevo.
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'skills' AND column_name IN ('command', 'icon');

-- Politicas: deben aparecer 4 (SELECT, INSERT, UPDATE, DELETE).
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'skills'
ORDER BY cmd;

-- Conteo posterior por usuario: debe coincidir con el conteo previo del paso 0.
SELECT user_id, count(*) AS skills FROM public.skills GROUP BY user_id ORDER BY user_id;

-- La vista debe devolver exactamente lo mismo que la tabla.
SELECT
  (SELECT count(*) FROM public.skills) AS filas_skills,
  (SELECT count(*) FROM public.user_tools) AS filas_vista;

-- ---------------------------------------------------------------------
-- ROLLBACK (ejecutar solo si hay que volver al modelo anterior)
-- ---------------------------------------------------------------------
-- DROP VIEW IF EXISTS public.user_tools;
-- ALTER TABLE public.user_tools_legacy RENAME TO user_tools;
-- DROP TABLE IF EXISTS public.skills;
