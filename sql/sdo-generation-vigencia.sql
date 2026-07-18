-- =====================================================================
-- SofLIA Hub - SDO-AN Fase 2: trazabilidad de generacion IA
-- EJECUTAR EN LA INSTANCIA SUPABASE DE SOFLIA HUB (VITE_SUPABASE_URL),
-- en el SQL Editor. NO en IRIS. Requiere sql/sdo-tables.sql aplicado.
--
-- Cada salida generativa relevante debe poder responder: que modelo la
-- produjo, con que prompt (id + version + hash), desde que evidencia,
-- y que registros creo o modifico.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.sdo_generation_runs (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  purpose TEXT NOT NULL,               -- 'extraccion_meeting' | 'minuta' | 'tarjeta_contexto' | ...
  model_used TEXT NOT NULL,            -- ej. 'gemini-3.5-flash'
  prompt_id TEXT NOT NULL,             -- ej. 'meeting-extraction'
  prompt_version TEXT NOT NULL,        -- PROMPT_VERSION exportada del codigo
  prompt_hash TEXT NOT NULL,           -- sha256 del prompt renderizado
  schema_version TEXT,
  input_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_object_refs JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{object_type, object_id}]
  ai_output_raw TEXT,
  validation_json JSONB,
  confidence DOUBLE PRECISION,
  owner_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdo_genruns_trace ON public.sdo_generation_runs(trace_id);
CREATE INDEX IF NOT EXISTS idx_sdo_genruns_prompt ON public.sdo_generation_runs(prompt_id, prompt_version);
CREATE INDEX IF NOT EXISTS idx_sdo_genruns_created ON public.sdo_generation_runs(created_at);

ALTER TABLE public.sdo_generation_runs ENABLE ROW LEVEL SECURITY;

-- Mismo criterio que sql/sdo-tables.sql: anon key sin sesion de Supabase Auth,
-- politica permisiva explicita, aislamiento a nivel de aplicacion.
-- TODO(seguridad): endurecer con auth.uid()/roles tras la migracion de auth.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sdo_generation_runs'
      AND policyname = 'Hub app manages sdo_generation_runs'
  ) THEN
    CREATE POLICY "Hub app manages sdo_generation_runs" ON public.sdo_generation_runs
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
