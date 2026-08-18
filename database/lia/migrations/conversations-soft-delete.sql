-- =====================================================================
-- Pulse Hub - Borrado logico de public.conversations
-- EJECUTAR EN LA INSTANCIA SUPABASE DEL HUB (VITE_SUPABASE_URL,
-- carpeta database/lia). NO en IRIS ni en SofLIA Learning.
--
-- Sintoma que corrige: una conversacion borrada en un equipo reaparecia en
-- otro. El borrado era un DELETE fisico y lo unico que sobrevivia al fallo
-- era una lapida en localStorage (`lia_deleted_conversations_<id>`), que no
-- viaja entre dispositivos: el segundo equipo volvia a listar la fila y la
-- devolvia al primero al sincronizar.
--
-- Cambio: borrar pasa a ser marcar `deleted_at`. La conversacion y sus
-- mensajes se conservan en la base; los clientes solo listan
-- `deleted_at IS NULL` y aprenden de esa marca los borrados hechos en otro
-- equipo.
--
-- Impacto: aditivo. No borra ni reescribe filas existentes; todas quedan con
-- `deleted_at NULL` (visibles). Idempotente: se puede ejecutar varias veces.
--
-- Precondicion: ninguna. El cliente tolera que esta migracion aun no este
-- aplicada (degrada al comportamiento anterior y lo avisa en consola), pero
-- hasta ejecutarla los borrados NO se sincronizan entre equipos.
-- =====================================================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

COMMENT ON COLUMN public.conversations.deleted_at IS
  'Borrado logico. NULL = visible para el usuario. Con valor, ningun cliente la lista, pero la fila y sus mensajes se conservan.';

-- El listado pide las conversaciones activas del usuario por updated_at.
CREATE INDEX IF NOT EXISTS idx_conversations_user_active
  ON public.conversations (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

-- La reconciliacion entre equipos pide solo los ids ya borrados del usuario.
CREATE INDEX IF NOT EXISTS idx_conversations_user_deleted
  ON public.conversations (user_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

-- El borrado logico es un UPDATE. Sin politica de UPDATE, RLS lo dejaria en
-- cero filas sin devolver error, que es exactamente el fallo silencioso que
-- este cambio viene a cerrar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversations'
      AND cmd IN ('UPDATE', 'ALL')
  ) THEN
    CREATE POLICY "Usuarios pueden actualizar sus conversaciones"
      ON public.conversations FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- =====================================================================
-- Verificacion (ejecutar y revisar los tres resultados)
-- =====================================================================

-- 1. La columna existe.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'deleted_at';

-- 2. Hay politica de SELECT, INSERT y UPDATE para el dueno.
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'conversations'
ORDER BY cmd;

-- 3. Reparto actual: al aplicar la migracion todo debe quedar en "activas".
SELECT count(*) FILTER (WHERE deleted_at IS NULL) AS activas,
       count(*) FILTER (WHERE deleted_at IS NOT NULL) AS borradas
FROM public.conversations;

-- =====================================================================
-- Rollback
-- =====================================================================
-- Quitar la columna es destructivo: pierde el registro de que conversaciones
-- borro el usuario y todas vuelven a aparecer. Preferir dejar la columna y
-- revertir el cliente.
--
-- ALTER TABLE public.conversations DROP COLUMN IF EXISTS deleted_at;
-- DROP INDEX IF EXISTS public.idx_conversations_user_active;
-- DROP INDEX IF EXISTS public.idx_conversations_user_deleted;
--
-- Restaurar una conversacion concreta sin tocar el esquema:
-- UPDATE public.conversations SET deleted_at = NULL WHERE id = '<uuid>';
