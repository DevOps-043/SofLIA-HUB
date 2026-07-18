-- =====================================================================
-- SofLIA Hub - Politicas RLS faltantes de public.messages
-- EJECUTAR EN LA INSTANCIA SUPABASE DE SOFLIA HUB (VITE_SUPABASE_URL,
-- proyecto hoervbaawahnsddrnmas). NO en IRIS ni SOFIA.
--
-- Sintoma que corrige: miles de errores 42501 "new row violates row-level
-- security policy (USING expression) for table messages" en los logs de
-- Postgres. La tabla solo tenia politicas de INSERT y SELECT; el chat del
-- Hub sincroniza con UPSERT (INSERT ... ON CONFLICT DO UPDATE): cuando el
-- mensaje ya existe entra por la rama UPDATE y, sin politica de UPDATE,
-- RLS la rechaza. La cola de sincronizacion reintenta indefinidamente y
-- genera el loop de errores.
--
-- Tambien falta DELETE: sin ella, borrar una conversacion deja los
-- mensajes huerfanos en silencio (RLS filtra el delete a 0 filas).
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages'
      AND policyname = 'Usuarios pueden actualizar mensajes de sus conversaciones'
  ) THEN
    CREATE POLICY "Usuarios pueden actualizar mensajes de sus conversaciones"
      ON public.messages FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages'
      AND policyname = 'Usuarios pueden eliminar mensajes de sus conversaciones'
  ) THEN
    CREATE POLICY "Usuarios pueden eliminar mensajes de sus conversaciones"
      ON public.messages FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Verificacion: deben aparecer 4 politicas (INSERT, SELECT, UPDATE, DELETE).
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'messages'
ORDER BY cmd;
