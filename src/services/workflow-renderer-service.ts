// ---------------------------------------------------------------------------
// workflow-renderer-service.ts
// Typed wrapper around the window.workflow API exposed by Electron preload.
// All calls go through IPC via the preload bridge.
// ---------------------------------------------------------------------------

// ---- Types ----------------------------------------------------------------

export interface PendingApproval {
  artifact_id: string;
  step_run_id: string;
  run_id: string;
  trace_id: string;
  step_key: string;
  step_name: string;
  artifact_type: string;
  ai_output_raw: string | null;
  qa_result: { passed: boolean; issues: string[] } | null;
  sla_due_at: string | null;
  assigned_to: string | null;
  workflow_name: string;
  trigger_type: string;
  context_data: Record<string, any>;
  created_at: string;
}

export interface WorkflowRun {
  run_id: string;
  definition_id: string;
  organization_id: string | null;
  trace_id: string;
  trigger_type: string;
  trigger_ref: string | null;
  current_step_key: string;
  status: string;
  context_data: Record<string, any>;
  opportunity_id: string | null;
  owner_id: string;
  started_at: string;
  completed_at: string | null;
}

export interface WorkflowStepRun {
  step_run_id: string;
  run_id: string;
  step_key: string;
  status: string;
  assigned_to: string | null;
  sla_due_at: string | null;
  escalated_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface WorkflowArtifact {
  artifact_id: string;
  step_run_id: string;
  run_id: string;
  trace_id: string;
  artifact_type: string;
  version: number;
  ai_output_raw: string | null;
  human_edit: string | null;
  human_final: string | null;
  qa_result: { passed: boolean; issues: string[] } | null;
  status: string;
  created_by: string;
  created_at: string;
}

export interface WorkflowApproval {
  approval_id: string;
  artifact_id: string;
  decision: string;
  reason: string | null;
  approved_by: string;
  created_at: string;
}

// ---- Internal helper ------------------------------------------------------

function getWorkflowAPI(): Record<string, (...args: any[]) => Promise<any>> | null {
  const api = (window as any).workflow;
  if (api && typeof api === 'object') {
    return api;
  }
  return null;
}

const NOT_AVAILABLE = { success: false as const, error: 'API no disponible' };

// ---- Public functions -----------------------------------------------------

/**
 * Check whether the workflow preload API is exposed in the current context.
 */
export function isWorkflowAvailable(): boolean {
  return getWorkflowAPI() !== null;
}

/**
 * Start a new workflow run from a definition slug.
 */
export async function startWorkflowRun(params: {
  definitionSlug: string;
  triggeredBy: string;
  triggerType: string;
  triggerRef?: string;
  initialContext: Record<string, any>;
  organizationId?: string;
}): Promise<{ success: boolean; run?: WorkflowRun; error?: string }> {
  const api = getWorkflowAPI();
  if (!api) return NOT_AVAILABLE;

  try {
    return await api.startWorkflowRun(params);
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * Retrieve a workflow run together with its steps, artifacts and approvals.
 */
export async function getWorkflowRun(
  runId: string,
): Promise<{
  success: boolean;
  data?: {
    run: WorkflowRun;
    steps: WorkflowStepRun[];
    artifacts: WorkflowArtifact[];
    approvals: WorkflowApproval[];
  };
  error?: string;
}> {
  const api = getWorkflowAPI();
  if (!api) return NOT_AVAILABLE;

  try {
    return await api.getWorkflowRun(runId);
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * Get artifacts pending human approval, optionally filtered.
 */
export async function getPendingApprovals(
  filters?: {
    organizationId?: string;
    assignedTo?: string;
    artifactType?: string;
  },
): Promise<{ success: boolean; approvals?: PendingApproval[]; error?: string }> {
  const api = getWorkflowAPI();
  if (!api) return NOT_AVAILABLE;

  try {
    return await api.getPendingApprovals(filters);
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * Submit an approval decision for an artifact.
 */
export async function submitApproval(params: {
  artifactId: string;
  decision: string;
  reason?: string;
  humanEdit?: string;
  approvedBy: string;
  roleAtTime?: string;
}): Promise<{ success: boolean; error?: string }> {
  const api = getWorkflowAPI();
  if (!api) return NOT_AVAILABLE;

  try {
    return await api.submitApproval(params);
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * Fetch a single workflow artifact by its ID.
 */
export async function getArtifact(
  artifactId: string,
): Promise<{ success: boolean; artifact?: WorkflowArtifact; error?: string }> {
  const api = getWorkflowAPI();
  if (!api) return NOT_AVAILABLE;

  try {
    return await api.getArtifact(artifactId);
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * List workflow runs with optional filters.
 */
export async function listWorkflowRuns(
  filters?: {
    organizationId?: string;
    ownerId?: string;
    status?: string;
    limit?: number;
  },
): Promise<{ success: boolean; runs?: WorkflowRun[]; error?: string }> {
  const api = getWorkflowAPI();
  if (!api) return NOT_AVAILABLE;

  try {
    return await api.listWorkflowRuns(filters);
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * Cancel an in-progress workflow run.
 */
export async function cancelWorkflowRun(
  runId: string,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  const api = getWorkflowAPI();
  if (!api) return NOT_AVAILABLE;

  try {
    return await api.cancelWorkflowRun(runId, reason);
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}
