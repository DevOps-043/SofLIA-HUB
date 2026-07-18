-- =====================================================================
-- SofLIA Hub - SDO-AN Fase 3: documentos como vistas + snapshot oficial
-- EJECUTAR EN LA INSTANCIA SUPABASE DE SOFLIA HUB (VITE_SUPABASE_URL),
-- en el SQL Editor. NO en IRIS. Requiere sql/sdo-tables.sql aplicado.
--
-- Un artefacto es una VISTA generada desde registros del SDO (minuta,
-- decision record, tarjeta de contexto). Al aprobarse se congela como
-- snapshot con hash sha256: el archivo pasa a ser evidencia verificable.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.sdo_artifacts (
  id TEXT PRIMARY KEY,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('minuta','decision_record','tarjeta_contexto')),
  title TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_version TEXT NOT NULL,
  record_refs JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{object_type, object_id}]
  generation_run_id TEXT REFERENCES public.sdo_generation_runs(id),
  version INTEGER NOT NULL DEFAULT 1,
  authority_status TEXT NOT NULL DEFAULT 'borrador' CHECK (authority_status IN ('borrador','propuesto','pendiente','aprobado','rechazado')),
  temporal_status TEXT NOT NULL DEFAULT 'futuro' CHECK (temporal_status IN ('futuro','vigente','reemplazado','vencido','archivado')),
  valid_from TIMESTAMPTZ,
  local_path TEXT,
  drive_file_id TEXT,
  uri TEXT,
  sha256 TEXT,                        -- obligatorio al aprobar (lo valida la app)
  approved_by_user_id TEXT,
  approved_at TIMESTAMPTZ,
  confidentiality TEXT NOT NULL DEFAULT 'P1' CHECK (confidentiality IN ('P0','P1','P2','P3')),
  owner_user_id TEXT NOT NULL,
  organization_id TEXT,
  trace_id TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdo_artifacts_owner ON public.sdo_artifacts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_sdo_artifacts_type ON public.sdo_artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_sdo_artifacts_authority ON public.sdo_artifacts(authority_status);

ALTER TABLE public.sdo_artifacts ENABLE ROW LEVEL SECURITY;

-- Mismo criterio que sql/sdo-tables.sql (anon key, politica permisiva
-- explicita, aislamiento a nivel de aplicacion).
-- TODO(seguridad): endurecer con auth.uid()/roles tras la migracion de auth.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sdo_artifacts'
      AND policyname = 'Hub app manages sdo_artifacts'
  ) THEN
    CREATE POLICY "Hub app manages sdo_artifacts" ON public.sdo_artifacts
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
