-- =====================================================================
-- SofLIA Hub — Workflow Engine + CRM-lite Tables
-- Execute this SQL in the IRIS Supabase instance (SQL Editor)
-- =====================================================================

-- =====================================================================
-- CRM-lite Tables
-- =====================================================================

-- 1. Companies (Empresas)
CREATE TABLE IF NOT EXISTS crm_companies (
  company_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  size_range TEXT,                          -- '1-10', '11-50', '51-200', '201-500', '500+'
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- 2. Contacts (Contactos)
CREATE TABLE IF NOT EXISTS crm_contacts (
  contact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES crm_companies(company_id) ON DELETE SET NULL,
  organization_id UUID,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role_title TEXT,
  linkedin_url TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Opportunities (Oportunidades)
CREATE TABLE IF NOT EXISTS crm_opportunities (
  opportunity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES crm_companies(company_id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(contact_id) ON DELETE SET NULL,
  organization_id UUID,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'lead',       -- 'lead','qualified','proposal','negotiation','won','lost'
  estimated_value NUMERIC,
  currency TEXT DEFAULT 'MXN',
  close_date DATE,
  pains TEXT[],
  objections TEXT[],
  next_step TEXT,
  owner_id UUID,
  lost_reason TEXT,
  won_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Interactions (Interacciones: reuniones, llamadas, emails, whatsapp)
CREATE TABLE IF NOT EXISTS crm_interactions (
  interaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES crm_opportunities(opportunity_id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(contact_id) ON DELETE SET NULL,
  organization_id UUID,
  interaction_type TEXT NOT NULL,           -- 'meeting','whatsapp','email','call','form'
  channel TEXT,                             -- 'whatsapp_hub','meet_extension','manual','gmail'
  raw_input TEXT,                           -- original transcript/note/message
  ai_summary TEXT,
  extracted_data JSONB DEFAULT '{}'::jsonb, -- structured extraction results
  trace_id UUID NOT NULL,                  -- end-to-end correlation
  source_ref TEXT,                         -- e.g. message_id, meeting_id
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================================
-- Workflow Engine Tables
-- =====================================================================

-- 5. Workflow Definitions (plantillas de proceso reutilizables)
CREATE TABLE IF NOT EXISTS workflow_definitions (
  definition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  slug TEXT NOT NULL UNIQUE,               -- 'meeting_followup', 'marketing_campaign', etc.
  name TEXT NOT NULL,
  description TEXT,
  steps_config JSONB NOT NULL,             -- ordered array of step definitions
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Workflow Runs (ejecuciones de un workflow)
CREATE TABLE IF NOT EXISTS workflow_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID REFERENCES workflow_definitions(definition_id),
  organization_id UUID,
  trace_id UUID NOT NULL UNIQUE,           -- end-to-end correlation key
  trigger_type TEXT NOT NULL,              -- 'whatsapp','meet_transcript','manual_form'
  trigger_ref TEXT,                        -- source message_id, etc.
  current_step_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',   -- 'active','completed','cancelled','error'
  context_data JSONB DEFAULT '{}'::jsonb,  -- accumulated data across steps
  opportunity_id UUID REFERENCES crm_opportunities(opportunity_id) ON DELETE SET NULL,
  owner_id UUID NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Workflow Step Runs (ejecución de cada paso)
CREATE TABLE IF NOT EXISTS workflow_step_runs (
  step_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES workflow_runs(run_id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending','in_progress','awaiting_approval',
                                           --  'approved','changes_requested','rejected',
                                           --  'executed','done','error','skipped'
  assigned_to UUID,
  sla_due_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================================
-- Artifacts + HITL Approvals (Auditable Ledger)
-- =====================================================================

-- 8. Workflow Artifacts (artefactos generados por IA)
CREATE TABLE IF NOT EXISTS workflow_artifacts (
  artifact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_run_id UUID REFERENCES workflow_step_runs(step_run_id) ON DELETE CASCADE,
  run_id UUID REFERENCES workflow_runs(run_id) ON DELETE CASCADE,
  trace_id UUID NOT NULL,
  artifact_type TEXT NOT NULL,             -- 'email_draft','whatsapp_message','iris_task',
                                           --  'meeting_agenda','proposal_brief',
                                           --  'entity_extraction','conversation_summary'
  version INTEGER NOT NULL DEFAULT 1,
  ai_output_raw TEXT,                      -- AI generated v1
  human_edit TEXT,                         -- human edited version v2
  human_final TEXT,                        -- approved final v3
  human_edit_diff JSONB,                   -- diff between ai_output_raw and human_edit
  prompt_hash TEXT,                        -- hash of prompt used for generation
  model_used TEXT,                         -- 'gemini-3-flash-preview', etc.
  qa_result JSONB,                         -- { passed: boolean, issues: string[] }
  status TEXT NOT NULL DEFAULT 'draft',    -- 'draft','pending_review','approved','rejected','executed'
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Workflow Approvals (decisiones HITL — ledger auditable)
CREATE TABLE IF NOT EXISTS workflow_approvals (
  approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID REFERENCES workflow_artifacts(artifact_id) ON DELETE CASCADE,
  step_run_id UUID REFERENCES workflow_step_runs(step_run_id) ON DELETE CASCADE,
  run_id UUID REFERENCES workflow_runs(run_id),
  trace_id UUID NOT NULL,
  decision TEXT NOT NULL,                  -- 'approved','rejected','changes_requested','more_context'
  reason TEXT,
  approved_by UUID NOT NULL,
  role_at_time TEXT,                       -- role of approver when decision was made
  evidence_links TEXT[],                   -- URLs/refs to supporting evidence
  artifact_version_before INTEGER,
  artifact_version_after INTEGER,
  idempotency_key TEXT UNIQUE,             -- prevents duplicate approvals
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================================
-- Indexes for performance
-- =====================================================================

-- CRM indexes
CREATE INDEX IF NOT EXISTS idx_crm_companies_org ON crm_companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company ON crm_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_org ON crm_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_company ON crm_opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_stage ON crm_opportunities(organization_id, stage);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_trace ON crm_interactions(trace_id);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_opp ON crm_interactions(opportunity_id);

-- Workflow indexes
CREATE INDEX IF NOT EXISTS idx_workflow_runs_trace ON workflow_runs(trace_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_owner ON workflow_runs(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_run ON workflow_step_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_status ON workflow_step_runs(status, sla_due_at);
CREATE INDEX IF NOT EXISTS idx_workflow_artifacts_step ON workflow_artifacts(step_run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_artifacts_trace ON workflow_artifacts(trace_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_artifact ON workflow_approvals(artifact_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_approver ON workflow_approvals(approved_by);

-- =====================================================================
-- RLS Policies (Row Level Security)
-- Allow all operations for the anon key (desktop app uses service role pattern)
-- =====================================================================

ALTER TABLE crm_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_step_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for crm_companies" ON crm_companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for crm_contacts" ON crm_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for crm_opportunities" ON crm_opportunities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for crm_interactions" ON crm_interactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for workflow_definitions" ON workflow_definitions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for workflow_runs" ON workflow_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for workflow_step_runs" ON workflow_step_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for workflow_artifacts" ON workflow_artifacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for workflow_approvals" ON workflow_approvals FOR ALL USING (true) WITH CHECK (true);

-- =====================================================================
-- Seed: Meeting Follow-up Workflow Definition
-- =====================================================================

INSERT INTO workflow_definitions (slug, name, description, steps_config) VALUES (
  'meeting_followup',
  'Reunión → Prospecto → Seguimiento',
  'Flujo completo desde reunión física hasta seguimiento comercial con aprobaciones HITL por paso.',
  '[
    {
      "step_key": "extract",
      "name": "Extracción IA",
      "type": "ai_generation",
      "artifact_type": "entity_extraction",
      "requires_approval": true,
      "sla_minutes": 60,
      "can_delegate": false,
      "auto_execute": false,
      "next_steps": ["create_crm"]
    },
    {
      "step_key": "create_crm",
      "name": "Crear/Actualizar Prospecto",
      "type": "execution",
      "artifact_type": null,
      "requires_approval": false,
      "sla_minutes": null,
      "can_delegate": false,
      "auto_execute": true,
      "next_steps": ["gen_email", "gen_whatsapp", "gen_tasks", "gen_agenda", "gen_proposal"]
    },
    {
      "step_key": "gen_email",
      "name": "Email de Seguimiento",
      "type": "ai_generation",
      "artifact_type": "email_draft",
      "requires_approval": true,
      "sla_minutes": 120,
      "can_delegate": true,
      "auto_execute": false,
      "next_steps": ["route_team"]
    },
    {
      "step_key": "gen_whatsapp",
      "name": "Mensaje WhatsApp",
      "type": "ai_generation",
      "artifact_type": "whatsapp_message",
      "requires_approval": true,
      "sla_minutes": 120,
      "can_delegate": true,
      "auto_execute": false,
      "next_steps": ["route_team"]
    },
    {
      "step_key": "gen_tasks",
      "name": "Tareas IRIS",
      "type": "ai_generation",
      "artifact_type": "iris_task",
      "requires_approval": true,
      "sla_minutes": 240,
      "can_delegate": true,
      "auto_execute": false,
      "next_steps": ["route_team"]
    },
    {
      "step_key": "gen_agenda",
      "name": "Agenda Siguiente Reunión",
      "type": "ai_generation",
      "artifact_type": "meeting_agenda",
      "requires_approval": true,
      "sla_minutes": 240,
      "can_delegate": true,
      "auto_execute": false,
      "next_steps": ["route_team"]
    },
    {
      "step_key": "gen_proposal",
      "name": "Brief de Propuesta",
      "type": "ai_generation",
      "artifact_type": "proposal_brief",
      "requires_approval": true,
      "sla_minutes": 2880,
      "can_delegate": true,
      "auto_execute": false,
      "next_steps": ["route_team"]
    },
    {
      "step_key": "route_team",
      "name": "Enrutamiento a Equipo",
      "type": "routing",
      "artifact_type": null,
      "requires_approval": false,
      "sla_minutes": null,
      "can_delegate": false,
      "auto_execute": true,
      "next_steps": ["close_cycle"]
    },
    {
      "step_key": "close_cycle",
      "name": "Cierre de Ciclo",
      "type": "execution",
      "artifact_type": null,
      "requires_approval": false,
      "sla_minutes": null,
      "can_delegate": false,
      "auto_execute": false,
      "next_steps": []
    }
  ]'::jsonb
) ON CONFLICT (slug) DO NOTHING;
