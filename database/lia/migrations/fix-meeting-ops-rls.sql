-- =====================================================================
-- FIX RLS de Meeting Ops en la base de SofLIA Hub (VITE_SUPABASE_URL).
--
-- Sintoma: "new row violates row-level security policy for table
-- meeting_runs" al crear una reunion. Causa: quedaron activas politicas
-- con auth.uid(), pero el proceso main del Hub entra con la anon key SIN
-- sesion de Supabase Auth -> auth.uid() es null -> todo insert se rechaza.
--
-- Este script NO recrea tablas: solo borra TODAS las politicas actuales de
-- las tablas de meetings (cualquier nombre) y crea politicas permisivas
-- explicitas para anon/authenticated. Idempotente: se puede correr varias
-- veces. Ejecutar en el SQL Editor de la base del Hub.
--
-- TODO(seguridad): endurecer con auth.uid()/roles cuando el Hub complete la
-- migracion a Supabase Auth (el aislamiento hoy es a nivel de aplicacion).
-- =====================================================================

DO $$
DECLARE
  tabla TEXT;
  pol RECORD;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'meeting_runs', 'meeting_source_artifacts', 'meeting_assets',
    'meeting_sync_actions', 'meeting_approvals', 'meeting_detection_candidates'
  ] LOOP
    -- Asegurar RLS habilitado (por si la tabla se creo sin el).
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabla);

    -- Borrar CUALQUIER politica existente en la tabla (sin adivinar nombres).
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tabla
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tabla);
    END LOOP;

    -- Politica permisiva unica para el acceso del Hub (anon + authenticated).
    EXECUTE format(
      'CREATE POLICY "Hub app manages %s" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      tabla, tabla
    );
  END LOOP;
END $$;
