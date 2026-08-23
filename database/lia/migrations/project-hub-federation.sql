-- =============================================================================
-- Lia: identidad federada y bindings de Project Hub.
-- Migración aditiva. Aplicar solo después de respaldo; no se ejecuta remotamente.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.federated_identities (
  identity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lia_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sofia_user_id uuid NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  verification_issuer text NOT NULL DEFAULT 'sofia-token-exchange',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lia_user_id),
  UNIQUE(sofia_user_id)
);

CREATE TABLE IF NOT EXISTS public.project_chat_bindings (
  binding_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iris_workspace_id uuid NOT NULL,
  iris_project_id uuid NOT NULL UNIQUE,
  lia_folder_id uuid NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  created_by_lia_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  binding_status text NOT NULL DEFAULT 'active' CHECK (binding_status IN ('pending', 'active', 'failed', 'revoked')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_chat_bindings_workspace
  ON public.project_chat_bindings(iris_workspace_id, created_at DESC);

ALTER TABLE public.federated_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_chat_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS federated_identities_read_self ON public.federated_identities;
CREATE POLICY federated_identities_read_self ON public.federated_identities
  FOR SELECT TO authenticated USING (lia_user_id = (SELECT auth.uid()));

-- La creación/verificación del mapping corresponde a una función server-side
-- que verificó SOFIA; el cliente autenticado no puede autoafirmar identidades.

DROP POLICY IF EXISTS project_chat_bindings_read_member ON public.project_chat_bindings;
CREATE POLICY project_chat_bindings_read_member ON public.project_chat_bindings
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.folders f WHERE f.id = lia_folder_id AND f.user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.folder_shares fs
       WHERE fs.folder_id = lia_folder_id AND fs.shared_with_user_id = (SELECT auth.uid())
         AND fs.is_active = true AND fs.revoked_at IS NULL
    )
  );

-- El consumidor firmado del outbox usa service_role para crear bindings y
-- actualizar folder_shares; no se concede escritura directa al renderer.

-- Meeting Ops: asociar ownership Lia verificable. Filas sin mapping quedan
-- ocultas hasta reconciliación, sin borrarlas ni inventar propietario.
ALTER TABLE public.meeting_runs ADD COLUMN IF NOT EXISTS owner_lia_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.meeting_detection_candidates ADD COLUMN IF NOT EXISTS owner_lia_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.meeting_runs mr
   SET owner_lia_user_id = fi.lia_user_id
  FROM public.federated_identities fi
 WHERE mr.owner_lia_user_id IS NULL
   AND (mr.owner_user_id = fi.sofia_user_id::text OR mr.owner_user_id = fi.lia_user_id::text);

UPDATE public.meeting_detection_candidates mc
   SET owner_lia_user_id = fi.lia_user_id
  FROM public.federated_identities fi
 WHERE mc.owner_lia_user_id IS NULL
   AND (mc.owner_user_id = fi.sofia_user_id::text OR mc.owner_user_id = fi.lia_user_id::text);

CREATE INDEX IF NOT EXISTS idx_meeting_runs_owner_lia ON public.meeting_runs(owner_lia_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_detection_owner_lia ON public.meeting_detection_candidates(owner_lia_user_id, detected_at DESC);

DO $$
DECLARE
  tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'meeting_runs', 'meeting_source_artifacts', 'meeting_assets',
    'meeting_sync_actions', 'meeting_approvals', 'meeting_detection_candidates'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Hub app manages %s" ON public.%I', tabla, tabla);
  END LOOP;
END $$;

DROP POLICY IF EXISTS meeting_runs_owner_policy ON public.meeting_runs;
CREATE POLICY meeting_runs_owner_policy ON public.meeting_runs
  FOR ALL TO authenticated
  USING (owner_lia_user_id = (SELECT auth.uid()))
  WITH CHECK (owner_lia_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS meeting_sources_owner_policy ON public.meeting_source_artifacts;
CREATE POLICY meeting_sources_owner_policy ON public.meeting_source_artifacts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meeting_runs r WHERE r.id = meeting_run_id AND r.owner_lia_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meeting_runs r WHERE r.id = meeting_run_id AND r.owner_lia_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS meeting_assets_owner_policy ON public.meeting_assets;
CREATE POLICY meeting_assets_owner_policy ON public.meeting_assets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meeting_runs r WHERE r.id = meeting_run_id AND r.owner_lia_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meeting_runs r WHERE r.id = meeting_run_id AND r.owner_lia_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS meeting_actions_owner_policy ON public.meeting_sync_actions;
CREATE POLICY meeting_actions_owner_policy ON public.meeting_sync_actions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meeting_runs r WHERE r.id = meeting_run_id AND r.owner_lia_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meeting_runs r WHERE r.id = meeting_run_id AND r.owner_lia_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS meeting_approvals_owner_policy ON public.meeting_approvals;
CREATE POLICY meeting_approvals_owner_policy ON public.meeting_approvals
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meeting_runs r WHERE r.id = meeting_run_id AND r.owner_lia_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meeting_runs r WHERE r.id = meeting_run_id AND r.owner_lia_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS meeting_detection_owner_policy ON public.meeting_detection_candidates;
CREATE POLICY meeting_detection_owner_policy ON public.meeting_detection_candidates
  FOR ALL TO authenticated
  USING (owner_lia_user_id = (SELECT auth.uid()))
  WITH CHECK (owner_lia_user_id = (SELECT auth.uid()));

COMMENT ON COLUMN public.meeting_runs.owner_lia_user_id IS
  'Identidad Lia verificada. NULL implica registro oculto pendiente de reconciliación.';

