-- =====================================================================
-- SofLIA Hub - Estado de servicios (workflows, plantillas, tareas)
-- EJECUTAR EN LA INSTANCIA SUPABASE DE SOFLIA HUB (VITE_SUPABASE_URL).
--
-- Respaldo en la nube del estado que antes vivia SOLO en JSON locales
-- (userData/): workflow-hub-state.json, workspace-automation,
-- scheduler-state.json y scheduled_tasks.json. Un formateo o cambio de
-- maquina ya no borra los workflows: al iniciar, la app restaura desde
-- aqui; tras cada guardado, espeja hacia aqui.
--
-- Una fila por servicio; el estado completo va en state_json (los
-- servicios cargan su estado entero en memoria, el acceso es 1:1).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.hub_service_state (
  service_name TEXT PRIMARY KEY,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_service_state ENABLE ROW LEVEL SECURITY;

-- El proceso main del Hub se conecta con la anon key SIN sesion de Supabase
-- Auth (la migracion de auth sigue pendiente): una politica con auth.uid()
-- bloquearia toda la app. Politica permisiva EXPLICITA y documentada; el
-- aislamiento es a nivel de aplicacion.
-- TODO(seguridad): endurecer con auth.uid()/roles cuando el Hub complete la
-- migracion a Supabase Auth.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hub_service_state' AND policyname = 'Hub app manages service state'
  ) THEN
    CREATE POLICY "Hub app manages service state"
      ON public.hub_service_state
      FOR ALL
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
