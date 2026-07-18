-- =====================================================================
-- SofLIA Hub - SDO-AN: Registro Operativo Gobernado (Fase 1)
-- EJECUTAR EN LA INSTANCIA SUPABASE DE SOFLIA HUB (VITE_SUPABASE_URL),
-- en el SQL Editor. NO en IRIS.
--
-- Sistema de Documentacion Operativa AI-Native: la unidad de conocimiento
-- es el registro gobernado (fuente, evidencia, afirmacion, decision,
-- accion, aprobacion) con tres ejes de estado independientes:
--   - epistemic_status: observado | corroborado | inferido | disputado | desconocido
--   - authority_status: borrador | propuesto | pendiente | aprobado | rechazado
--   - temporal_status:  futuro | vigente | reemplazado | vencido | archivado
--
-- Reglas: la IA nunca aprueba (decided_by_user_id siempre humano);
-- la fecha mas reciente no prevalece; una edicion no sustituye una
-- aprobacion; toda sustitucion enlaza al registro anterior (supersedes).
-- =====================================================================

-- ---------------------------------------------------------------------
-- sdo_sources: sistema de origen (fuente federada; no duplica contenido)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sdo_sources (
  id TEXT PRIMARY KEY,
  system TEXT NOT NULL,            -- 'meeting' | 'drive' | 'gmail' | 'whatsapp' | 'manual' | 'crm'
  source_type TEXT NOT NULL,       -- 'transcripcion' | 'documento' | 'correo' | 'mensaje' | ...
  uri TEXT,
  external_ref TEXT,               -- ej. meeting_run_id
  custodian TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confidentiality TEXT NOT NULL DEFAULT 'P1' CHECK (confidentiality IN ('P0','P1','P2','P3')),
  owner_user_id TEXT NOT NULL,
  organization_id TEXT,
  trace_id TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdo_sources_owner ON public.sdo_sources(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_sdo_sources_external_ref ON public.sdo_sources(external_ref);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sdo_sources_system_external
  ON public.sdo_sources(system, external_ref) WHERE external_ref IS NOT NULL;

-- ---------------------------------------------------------------------
-- sdo_evidence: captura inmutable con hash
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sdo_evidence (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES public.sdo_sources(id) ON DELETE CASCADE,
  sha256 TEXT NOT NULL,
  storage_uri TEXT,                -- ruta local / drive id del original o snapshot
  mime_type TEXT,
  excerpt TEXT,                    -- fragmento citable (opcional)
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confidentiality TEXT NOT NULL DEFAULT 'P1' CHECK (confidentiality IN ('P0','P1','P2','P3')),
  owner_user_id TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdo_evidence_source ON public.sdo_evidence(source_id);
CREATE INDEX IF NOT EXISTS idx_sdo_evidence_sha ON public.sdo_evidence(sha256);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sdo_evidence_source_sha
  ON public.sdo_evidence(source_id, sha256);

-- ---------------------------------------------------------------------
-- sdo_claims: afirmacion gobernada (unidad minima de conocimiento)
-- source_refs: [{ evidence_id, locator?, excerpt? }]
-- confidence expresa confianza de EXTRACCION, no nivel de verdad.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sdo_claims (
  id TEXT PRIMARY KEY,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('hecho','decision','compromiso','requisito','riesgo','propuesta')),
  statement TEXT NOT NULL,
  subject TEXT,
  object_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  epistemic_status TEXT NOT NULL DEFAULT 'desconocido' CHECK (epistemic_status IN ('observado','corroborado','inferido','disputado','desconocido')),
  authority_status TEXT NOT NULL DEFAULT 'borrador' CHECK (authority_status IN ('borrador','propuesto','pendiente','aprobado','rechazado')),
  temporal_status TEXT NOT NULL DEFAULT 'futuro' CHECK (temporal_status IN ('futuro','vigente','reemplazado','vencido','archivado')),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  review_due TIMESTAMPTZ,
  supersedes_id TEXT REFERENCES public.sdo_claims(id),
  reviewer_user_id TEXT,
  approver_user_id TEXT,
  authority_basis TEXT,
  extracted_by TEXT NOT NULL DEFAULT 'humano' CHECK (extracted_by IN ('humano','ia')),
  model_version TEXT,
  prompt_version TEXT,
  confidence DOUBLE PRECISION,
  idempotency_key TEXT UNIQUE,
  origin_system TEXT,
  origin_ref TEXT,
  confidentiality TEXT NOT NULL DEFAULT 'P1' CHECK (confidentiality IN ('P0','P1','P2','P3')),
  owner_user_id TEXT NOT NULL,
  organization_id TEXT,
  trace_id TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdo_claims_owner ON public.sdo_claims(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_sdo_claims_authority ON public.sdo_claims(authority_status);
CREATE INDEX IF NOT EXISTS idx_sdo_claims_temporal ON public.sdo_claims(temporal_status);
CREATE INDEX IF NOT EXISTS idx_sdo_claims_review_due ON public.sdo_claims(review_due);
CREATE INDEX IF NOT EXISTS idx_sdo_claims_subject ON public.sdo_claims(subject);
CREATE INDEX IF NOT EXISTS idx_sdo_claims_origin_ref ON public.sdo_claims(origin_ref);

-- ---------------------------------------------------------------------
-- sdo_decisions: registro de decision (plantilla A del SDO-AN)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sdo_decisions (
  id TEXT PRIMARY KEY,
  question TEXT,                   -- pregunta que resuelve la decision
  statement TEXT NOT NULL,         -- la decision en si
  context TEXT,
  options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  consequences TEXT,
  decision_owner TEXT,             -- quien tiene autoridad para decidir
  authority_basis TEXT,
  communication_rule TEXT,         -- restricciones de comunicacion externa
  source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  epistemic_status TEXT NOT NULL DEFAULT 'desconocido' CHECK (epistemic_status IN ('observado','corroborado','inferido','disputado','desconocido')),
  authority_status TEXT NOT NULL DEFAULT 'borrador' CHECK (authority_status IN ('borrador','propuesto','pendiente','aprobado','rechazado')),
  temporal_status TEXT NOT NULL DEFAULT 'futuro' CHECK (temporal_status IN ('futuro','vigente','reemplazado','vencido','archivado')),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  review_due TIMESTAMPTZ,
  supersedes_id TEXT REFERENCES public.sdo_decisions(id),
  approved_at TIMESTAMPTZ,
  approved_by_user_id TEXT,
  origin_system TEXT,              -- ej. 'meeting'
  origin_ref TEXT,                 -- ej. meeting_run_id
  idempotency_key TEXT UNIQUE,
  extracted_by TEXT NOT NULL DEFAULT 'humano' CHECK (extracted_by IN ('humano','ia')),
  model_version TEXT,
  prompt_version TEXT,
  confidence DOUBLE PRECISION,
  confidentiality TEXT NOT NULL DEFAULT 'P1' CHECK (confidentiality IN ('P0','P1','P2','P3')),
  owner_user_id TEXT NOT NULL,
  organization_id TEXT,
  trace_id TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdo_decisions_owner ON public.sdo_decisions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_sdo_decisions_authority ON public.sdo_decisions(authority_status);
CREATE INDEX IF NOT EXISTS idx_sdo_decisions_temporal ON public.sdo_decisions(temporal_status);
CREATE INDEX IF NOT EXISTS idx_sdo_decisions_review_due ON public.sdo_decisions(review_due);
CREATE INDEX IF NOT EXISTS idx_sdo_decisions_origin_ref ON public.sdo_decisions(origin_ref);

-- ---------------------------------------------------------------------
-- sdo_actions: pendientes y compromisos (sin eje epistemologico:
-- una accion es un compromiso, no una afirmacion sobre el mundo)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sdo_actions (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  responsible TEXT,                -- candidato u owner confirmado
  decision_id TEXT REFERENCES public.sdo_decisions(id),
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta','en_curso','bloqueada','completada','cancelada')),
  authority_status TEXT NOT NULL DEFAULT 'borrador' CHECK (authority_status IN ('borrador','propuesto','pendiente','aprobado','rechazado')),
  temporal_status TEXT NOT NULL DEFAULT 'futuro' CHECK (temporal_status IN ('futuro','vigente','reemplazado','vencido','archivado')),
  valid_from TIMESTAMPTZ,
  review_due TIMESTAMPTZ,
  source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  origin_system TEXT,
  origin_ref TEXT,
  external_ref TEXT,               -- ej. issue de IRIS ya creado
  idempotency_key TEXT UNIQUE,
  extracted_by TEXT NOT NULL DEFAULT 'humano' CHECK (extracted_by IN ('humano','ia')),
  confidence DOUBLE PRECISION,
  confidentiality TEXT NOT NULL DEFAULT 'P1' CHECK (confidentiality IN ('P0','P1','P2','P3')),
  owner_user_id TEXT NOT NULL,
  organization_id TEXT,
  trace_id TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdo_actions_owner ON public.sdo_actions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_sdo_actions_status ON public.sdo_actions(status);
CREATE INDEX IF NOT EXISTS idx_sdo_actions_decision ON public.sdo_actions(decision_id);
CREATE INDEX IF NOT EXISTS idx_sdo_actions_origin_ref ON public.sdo_actions(origin_ref);
CREATE INDEX IF NOT EXISTS idx_sdo_actions_review_due ON public.sdo_actions(review_due);

-- ---------------------------------------------------------------------
-- sdo_approvals: acto de autoridad. decided_by_user_id SIEMPRE humano
-- (el servicio lo valida; la IA no tiene ruta hacia esta tabla).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sdo_approvals (
  id TEXT PRIMARY KEY,
  object_type TEXT NOT NULL CHECK (object_type IN ('claim','decision','action','artifact')),
  object_id TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL,
  decided_by_user_id TEXT NOT NULL,
  role_at_time TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('aprobado','rechazado')),
  comment TEXT,
  evidence_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  object_version_before INTEGER,
  object_version_after INTEGER,
  idempotency_key TEXT NOT NULL UNIQUE,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  organization_id TEXT,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdo_approvals_object ON public.sdo_approvals(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_sdo_approvals_decided_by ON public.sdo_approvals(decided_by_user_id);

-- ---------------------------------------------------------------------
-- sdo_audit_events: bitacora append-only (NO event sourcing total;
-- solo los eventos de gobierno del SDO-AN).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sdo_audit_events (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('humano','ia','sistema')),
  actor_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('creado','propuesto','editado','aprobado','rechazado','reemplazado','vencido','archivado','publicado','eliminacion_autorizada')),
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  reason TEXT,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdo_audit_object ON public.sdo_audit_events(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_sdo_audit_event_type ON public.sdo_audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sdo_audit_created ON public.sdo_audit_events(created_at);

-- Garantia append-only: bloquear UPDATE y DELETE sobre la bitacora.
CREATE OR REPLACE FUNCTION public.sdo_audit_events_bloquear_mutacion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'sdo_audit_events es append-only: no se permite % sobre la bitacora.', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sdo_audit_append_only ON public.sdo_audit_events;
CREATE TRIGGER trg_sdo_audit_append_only
  BEFORE UPDATE OR DELETE ON public.sdo_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.sdo_audit_events_bloquear_mutacion();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.sdo_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdo_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdo_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdo_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdo_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdo_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdo_audit_events ENABLE ROW LEVEL SECURITY;

-- El proceso main del Hub se conecta con la anon key SIN sesion de Supabase
-- Auth (la migracion de auth sigue pendiente): politicas con auth.uid()
-- bloquearian toda la app. Politicas permisivas EXPLICITAS y documentadas;
-- el aislamiento por usuario (owner_user_id) se aplica a nivel de aplicacion.
-- TODO(seguridad): endurecer con auth.uid()/roles cuando el Hub complete la
-- migracion a Supabase Auth.
DO $$
DECLARE
  tabla TEXT;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'sdo_sources', 'sdo_evidence', 'sdo_claims', 'sdo_decisions',
    'sdo_actions', 'sdo_approvals', 'sdo_audit_events'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tabla AND policyname = 'Hub app manages ' || tabla
    ) THEN
      EXECUTE format(
        'CREATE POLICY "Hub app manages %s" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
        tabla, tabla
      );
    END IF;
  END LOOP;
END $$;
