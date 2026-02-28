/**
 * Workflow Engine — Generic BPM-lite State Machine
 *
 * Reusable workflow engine for commercial/marketing/operational processes.
 * Follows the EventEmitter pattern used by MonitoringService, CalendarService, etc.
 */
import { EventEmitter } from 'events';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'node:path';
import { app } from 'electron';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

// Load .env from project root
const envPath = path.join(app.getAppPath(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// ─── Types ───────────────────────────────────────────────────────────

export interface WorkflowStepConfig {
  step_key: string;
  name: string;
  type: 'ai_generation' | 'hitl_approval' | 'execution' | 'routing';
  artifact_type: string | null;
  requires_approval: boolean;
  sla_minutes: number | null;
  can_delegate: boolean;
  auto_execute: boolean;
  next_steps: string[];
}

export interface WorkflowDefinition {
  definition_id: string;
  organization_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  steps_config: WorkflowStepConfig[];
  is_active: boolean;
  version: number;
}

export interface WorkflowRun {
  run_id: string;
  definition_id: string;
  organization_id: string | null;
  trace_id: string;
  trigger_type: string;
  trigger_ref: string | null;
  current_step_key: string;
  status: 'active' | 'completed' | 'cancelled' | 'error';
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
  status: StepStatus;
  assigned_to: string | null;
  sla_due_at: string | null;
  escalated_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  metadata: Record<string, any>;
}

export type StepStatus =
  | 'pending' | 'in_progress' | 'awaiting_approval'
  | 'approved' | 'changes_requested' | 'rejected'
  | 'executed' | 'done' | 'error' | 'skipped';

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
  human_edit_diff: Record<string, any> | null;
  prompt_hash: string | null;
  model_used: string | null;
  qa_result: { passed: boolean; issues: string[] } | null;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'executed';
  created_by: string;
}

export interface WorkflowApproval {
  approval_id: string;
  artifact_id: string;
  step_run_id: string;
  run_id: string;
  trace_id: string;
  decision: 'approved' | 'rejected' | 'changes_requested' | 'more_context';
  reason: string | null;
  approved_by: string;
  role_at_time: string | null;
  evidence_links: string[];
  idempotency_key: string;
  created_at: string;
}

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

export interface SLABreach {
  step_run_id: string;
  run_id: string;
  step_key: string;
  sla_due_at: string;
  assigned_to: string | null;
  workflow_name: string;
}

export interface ApprovalFilters {
  organizationId?: string;
  assignedTo?: string;
  artifactType?: string;
  status?: string;
}

// ─── IRIS Supabase Client ────────────────────────────────────────────

const IRIS_URL = process.env.VITE_IRIS_SUPABASE_URL || '';
const IRIS_KEY = process.env.VITE_IRIS_SUPABASE_ANON_KEY || '';

let irisClient: SupabaseClient | null = null;

function getIrisClient(): SupabaseClient | null {
  if (irisClient) return irisClient;
  if (!IRIS_URL || !IRIS_KEY) {
    console.warn('[WorkflowEngine] No IRIS credentials found in env');
    return null;
  }
  try {
    irisClient = createClient(IRIS_URL, IRIS_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return irisClient;
  } catch (err) {
    console.error('[WorkflowEngine] Failed to create IRIS client:', err);
    return null;
  }
}

// ─── Workflow Engine Class ───────────────────────────────────────────

export class WorkflowEngine extends EventEmitter {

  constructor() {
    super();
    console.log('[WorkflowEngine] Initialized');
  }

  // ─── Get Definition ──────────────────────────────────────────────

  async getDefinition(slug: string): Promise<WorkflowDefinition | null> {
    const iris = getIrisClient();
    if (!iris) return null;

    const { data, error } = await iris
      .from('workflow_definitions')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.error('[WorkflowEngine] getDefinition error:', error);
      return null;
    }

    return data as WorkflowDefinition;
  }

  // ─── Start a new Workflow Run ────────────────────────────────────

  async startRun(params: {
    definitionSlug: string;
    triggeredBy: string;
    triggerType: string;
    triggerRef?: string;
    initialContext: Record<string, any>;
    organizationId?: string;
  }): Promise<WorkflowRun | null> {
    const iris = getIrisClient();
    if (!iris) return null;

    const definition = await this.getDefinition(params.definitionSlug);
    if (!definition) {
      console.error(`[WorkflowEngine] Definition not found: ${params.definitionSlug}`);
      return null;
    }

    const steps = definition.steps_config as WorkflowStepConfig[];
    if (steps.length === 0) {
      console.error('[WorkflowEngine] Definition has no steps');
      return null;
    }

    const traceId = randomUUID();
    const firstStep = steps[0];

    // Create the workflow run
    const { data: run, error: runError } = await iris
      .from('workflow_runs')
      .insert({
        definition_id: definition.definition_id,
        organization_id: params.organizationId || definition.organization_id,
        trace_id: traceId,
        trigger_type: params.triggerType,
        trigger_ref: params.triggerRef || null,
        current_step_key: firstStep.step_key,
        status: 'active',
        context_data: params.initialContext,
        owner_id: params.triggeredBy,
      })
      .select('*')
      .single();

    if (runError || !run) {
      console.error('[WorkflowEngine] startRun insert error:', runError);
      return null;
    }

    // Create the first step run
    const slaDate = firstStep.sla_minutes
      ? new Date(Date.now() + firstStep.sla_minutes * 60_000).toISOString()
      : null;

    const { error: stepError } = await iris
      .from('workflow_step_runs')
      .insert({
        run_id: run.run_id,
        step_key: firstStep.step_key,
        status: 'in_progress',
        assigned_to: params.triggeredBy,
        sla_due_at: slaDate,
        started_at: new Date().toISOString(),
      });

    if (stepError) {
      console.error('[WorkflowEngine] First step insert error:', stepError);
    }

    console.log(`[WorkflowEngine] Run started: ${run.run_id} (trace: ${traceId}), step: ${firstStep.step_key}`);
    this.emit('step:started', { runId: run.run_id, stepKey: firstStep.step_key, traceId });

    return run as WorkflowRun;
  }

  // ─── Save Artifact ───────────────────────────────────────────────

  async saveArtifact(params: {
    stepRunId: string;
    runId: string;
    traceId: string;
    artifactType: string;
    aiOutputRaw: string;
    promptHash?: string;
    modelUsed?: string;
    qaResult?: { passed: boolean; issues: string[] };
    createdBy: string;
  }): Promise<WorkflowArtifact | null> {
    const iris = getIrisClient();
    if (!iris) return null;

    const { data, error } = await iris
      .from('workflow_artifacts')
      .insert({
        step_run_id: params.stepRunId,
        run_id: params.runId,
        trace_id: params.traceId,
        artifact_type: params.artifactType,
        version: 1,
        ai_output_raw: params.aiOutputRaw,
        prompt_hash: params.promptHash || null,
        model_used: params.modelUsed || null,
        qa_result: params.qaResult || null,
        status: 'pending_review',
        created_by: params.createdBy,
      })
      .select('*')
      .single();

    if (error || !data) {
      console.error('[WorkflowEngine] saveArtifact error:', error);
      return null;
    }

    // Update step status to awaiting_approval
    await iris
      .from('workflow_step_runs')
      .update({ status: 'awaiting_approval', updated_at: new Date().toISOString() })
      .eq('step_run_id', params.stepRunId);

    console.log(`[WorkflowEngine] Artifact saved: ${data.artifact_id} (type: ${params.artifactType})`);
    this.emit('approval:needed', {
      runId: params.runId,
      stepRunId: params.stepRunId,
      artifactId: data.artifact_id,
      artifactType: params.artifactType,
      traceId: params.traceId,
    });

    return data as WorkflowArtifact;
  }

  // ─── Submit Approval ─────────────────────────────────────────────

  async submitApproval(params: {
    artifactId: string;
    decision: 'approved' | 'rejected' | 'changes_requested' | 'more_context';
    reason?: string;
    humanEdit?: string;
    approvedBy: string;
    roleAtTime?: string;
    evidenceLinks?: string[];
  }): Promise<{ success: boolean; error?: string }> {
    const iris = getIrisClient();
    if (!iris) return { success: false, error: 'IRIS no disponible' };

    // Get the artifact
    const { data: artifact, error: artError } = await iris
      .from('workflow_artifacts')
      .select('*')
      .eq('artifact_id', params.artifactId)
      .single();

    if (artError || !artifact) {
      return { success: false, error: 'Artefacto no encontrado' };
    }

    const idempotencyKey = `${params.artifactId}:${params.decision}:${Date.now()}`;

    // Record the approval decision
    const { error: approvalError } = await iris
      .from('workflow_approvals')
      .insert({
        artifact_id: params.artifactId,
        step_run_id: artifact.step_run_id,
        run_id: artifact.run_id,
        trace_id: artifact.trace_id,
        decision: params.decision,
        reason: params.reason || null,
        approved_by: params.approvedBy,
        role_at_time: params.roleAtTime || null,
        evidence_links: params.evidenceLinks || [],
        artifact_version_before: artifact.version,
        artifact_version_after: params.humanEdit ? artifact.version + 1 : artifact.version,
        idempotency_key: idempotencyKey,
      });

    if (approvalError) {
      console.error('[WorkflowEngine] submitApproval insert error:', approvalError);
      return { success: false, error: approvalError.message };
    }

    // Update the artifact based on decision
    const artifactUpdate: Record<string, any> = { updated_at: new Date().toISOString() };

    if (params.decision === 'approved') {
      artifactUpdate.status = 'approved';
      artifactUpdate.human_final = params.humanEdit || artifact.ai_output_raw;
      if (params.humanEdit) {
        artifactUpdate.human_edit = params.humanEdit;
        artifactUpdate.version = artifact.version + 1;
      }
    } else if (params.decision === 'rejected') {
      artifactUpdate.status = 'rejected';
    } else if (params.decision === 'changes_requested') {
      artifactUpdate.status = 'draft';
      if (params.humanEdit) {
        artifactUpdate.human_edit = params.humanEdit;
        artifactUpdate.version = artifact.version + 1;
      }
    }
    // 'more_context' doesn't change artifact status

    await iris
      .from('workflow_artifacts')
      .update(artifactUpdate)
      .eq('artifact_id', params.artifactId);

    // Update step status based on decision
    let stepStatus: StepStatus;
    if (params.decision === 'approved') {
      stepStatus = 'approved';
    } else if (params.decision === 'rejected') {
      stepStatus = 'rejected';
    } else if (params.decision === 'changes_requested') {
      stepStatus = 'changes_requested';
    } else {
      stepStatus = 'awaiting_approval'; // more_context — stay in waiting
    }

    const stepUpdate: Record<string, any> = {
      status: stepStatus,
      updated_at: new Date().toISOString(),
    };
    if (stepStatus === 'approved' || stepStatus === 'rejected') {
      stepUpdate.completed_at = new Date().toISOString();
    }

    await iris
      .from('workflow_step_runs')
      .update(stepUpdate)
      .eq('step_run_id', artifact.step_run_id);

    console.log(`[WorkflowEngine] Approval: ${params.decision} for artifact ${params.artifactId}`);
    this.emit('approval:decided', {
      runId: artifact.run_id,
      stepRunId: artifact.step_run_id,
      artifactId: params.artifactId,
      decision: params.decision,
      traceId: artifact.trace_id,
    });

    // If approved, try to advance the workflow
    if (params.decision === 'approved') {
      await this.tryAdvanceWorkflow(artifact.run_id);
    }

    return { success: true };
  }

  // ─── Try to Advance Workflow ─────────────────────────────────────

  async tryAdvanceWorkflow(runId: string): Promise<void> {
    const iris = getIrisClient();
    if (!iris) return;

    // Get the run with its definition
    const { data: run } = await iris
      .from('workflow_runs')
      .select('*, definition:workflow_definitions(*)')
      .eq('run_id', runId)
      .single();

    if (!run || run.status !== 'active') return;

    const steps = (run.definition as any).steps_config as WorkflowStepConfig[];

    // Get all step runs for this workflow
    const { data: stepRuns } = await iris
      .from('workflow_step_runs')
      .select('*')
      .eq('run_id', runId);

    if (!stepRuns) return;

    const stepRunMap = new Map<string, WorkflowStepRun>();
    for (const sr of stepRuns) {
      stepRunMap.set(sr.step_key, sr as WorkflowStepRun);
    }

    // Find steps that can be started
    for (const stepConfig of steps) {
      const existingRun = stepRunMap.get(stepConfig.step_key);
      if (existingRun) continue; // Already exists

      // Check if all prerequisites are met
      const prerequisites = steps.filter(s => s.next_steps.includes(stepConfig.step_key));
      if (prerequisites.length === 0 && stepConfig !== steps[0]) continue;

      const allPrerequisitesDone = prerequisites.every(prereq => {
        const prereqRun = stepRunMap.get(prereq.step_key);
        return prereqRun && (
          prereqRun.status === 'done' ||
          prereqRun.status === 'approved' ||
          prereqRun.status === 'executed' ||
          prereqRun.status === 'skipped'
        );
      });

      if (!allPrerequisitesDone) continue;

      // For route_team: ALL generation steps must be done/approved/skipped
      if (stepConfig.step_key === 'route_team') {
        const genSteps = steps.filter(s => s.next_steps.includes('route_team'));
        const allGenDone = genSteps.every(gs => {
          const gsr = stepRunMap.get(gs.step_key);
          return gsr && (gsr.status === 'done' || gsr.status === 'approved' ||
                        gsr.status === 'executed' || gsr.status === 'skipped' || gsr.status === 'rejected');
        });
        if (!allGenDone) continue;
      }

      // Create the step run
      const slaDate = stepConfig.sla_minutes
        ? new Date(Date.now() + stepConfig.sla_minutes * 60_000).toISOString()
        : null;

      const { data: newStepRun } = await iris
        .from('workflow_step_runs')
        .insert({
          run_id: runId,
          step_key: stepConfig.step_key,
          status: stepConfig.auto_execute ? 'executed' : 'in_progress',
          assigned_to: run.owner_id,
          sla_due_at: slaDate,
          started_at: new Date().toISOString(),
          completed_at: stepConfig.auto_execute ? new Date().toISOString() : null,
        })
        .select('*')
        .single();

      if (newStepRun) {
        // Update current_step_key
        await iris
          .from('workflow_runs')
          .update({ current_step_key: stepConfig.step_key, updated_at: new Date().toISOString() })
          .eq('run_id', runId);

        console.log(`[WorkflowEngine] Step advanced: ${stepConfig.step_key} (auto_execute: ${stepConfig.auto_execute})`);
        this.emit('step:started', { runId, stepKey: stepConfig.step_key, traceId: run.trace_id });

        // If auto_execute, mark as done and continue advancing
        if (stepConfig.auto_execute) {
          await iris
            .from('workflow_step_runs')
            .update({ status: 'done', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('step_run_id', newStepRun.step_run_id);

          this.emit('step:completed', { runId, stepKey: stepConfig.step_key, traceId: run.trace_id });

          // Recursively try to advance again
          await this.tryAdvanceWorkflow(runId);
          return;
        }
      }
    }

    // Check if workflow is complete (all steps done or no more pending)
    const allStepsDone = steps.every(s => {
      const sr = stepRunMap.get(s.step_key);
      return sr && (sr.status === 'done' || sr.status === 'executed' || sr.status === 'skipped' || sr.status === 'rejected');
    });

    if (allStepsDone) {
      await iris
        .from('workflow_runs')
        .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('run_id', runId);

      console.log(`[WorkflowEngine] Run completed: ${runId}`);
      this.emit('run:completed', { runId, traceId: run.trace_id });
    }
  }

  // ─── Complete a Step (mark as done) ──────────────────────────────

  async completeStep(stepRunId: string): Promise<void> {
    const iris = getIrisClient();
    if (!iris) return;

    const { data: stepRun } = await iris
      .from('workflow_step_runs')
      .select('*')
      .eq('step_run_id', stepRunId)
      .single();

    if (!stepRun) return;

    await iris
      .from('workflow_step_runs')
      .update({ status: 'done', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('step_run_id', stepRunId);

    this.emit('step:completed', { runId: stepRun.run_id, stepKey: stepRun.step_key });
    await this.tryAdvanceWorkflow(stepRun.run_id);
  }

  // ─── Get Pending Approvals ───────────────────────────────────────

  async getPendingApprovals(filters?: ApprovalFilters): Promise<PendingApproval[]> {
    const iris = getIrisClient();
    if (!iris) return [];

    try {
      // Get step runs that are awaiting approval
      let query = iris
        .from('workflow_step_runs')
        .select('*, run:workflow_runs(*, definition:workflow_definitions(name, steps_config))')
        .eq('status', 'awaiting_approval')
        .order('sla_due_at', { ascending: true, nullsFirst: false });

      if (filters?.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }

      const { data: stepRuns, error } = await query;
      if (error || !stepRuns) {
        console.error('[WorkflowEngine] getPendingApprovals error:', error);
        return [];
      }

      const results: PendingApproval[] = [];

      for (const sr of stepRuns) {
        const run = sr.run as any;
        if (!run || run.status !== 'active') continue;

        if (filters?.organizationId && run.organization_id !== filters.organizationId) continue;

        // Get the artifact for this step
        const { data: artifacts } = await iris
          .from('workflow_artifacts')
          .select('*')
          .eq('step_run_id', sr.step_run_id)
          .eq('status', 'pending_review')
          .order('created_at', { ascending: false })
          .limit(1);

        const artifact = artifacts?.[0];
        if (!artifact) continue;

        if (filters?.artifactType && artifact.artifact_type !== filters.artifactType) continue;

        const stepsConfig = (run.definition as any)?.steps_config || [];
        const stepConfig = stepsConfig.find((s: any) => s.step_key === sr.step_key);

        results.push({
          artifact_id: artifact.artifact_id,
          step_run_id: sr.step_run_id,
          run_id: sr.run_id,
          trace_id: artifact.trace_id,
          step_key: sr.step_key,
          step_name: stepConfig?.name || sr.step_key,
          artifact_type: artifact.artifact_type,
          ai_output_raw: artifact.ai_output_raw,
          qa_result: artifact.qa_result,
          sla_due_at: sr.sla_due_at,
          assigned_to: sr.assigned_to,
          workflow_name: (run.definition as any)?.name || 'Workflow',
          trigger_type: run.trigger_type,
          context_data: run.context_data || {},
          created_at: artifact.created_at,
        });
      }

      return results;
    } catch (err) {
      console.error('[WorkflowEngine] getPendingApprovals exception:', err);
      return [];
    }
  }

  // ─── Get Run Status ──────────────────────────────────────────────

  async getRunStatus(runId: string): Promise<{
    run: WorkflowRun;
    steps: WorkflowStepRun[];
    artifacts: WorkflowArtifact[];
    approvals: WorkflowApproval[];
  } | null> {
    const iris = getIrisClient();
    if (!iris) return null;

    const { data: run } = await iris
      .from('workflow_runs')
      .select('*')
      .eq('run_id', runId)
      .single();

    if (!run) return null;

    const [stepsRes, artifactsRes, approvalsRes] = await Promise.all([
      iris.from('workflow_step_runs').select('*').eq('run_id', runId).order('created_at'),
      iris.from('workflow_artifacts').select('*').eq('run_id', runId).order('created_at'),
      iris.from('workflow_approvals').select('*').eq('run_id', runId).order('created_at'),
    ]);

    return {
      run: run as WorkflowRun,
      steps: (stepsRes.data || []) as WorkflowStepRun[],
      artifacts: (artifactsRes.data || []) as WorkflowArtifact[],
      approvals: (approvalsRes.data || []) as WorkflowApproval[],
    };
  }

  // ─── List Runs ───────────────────────────────────────────────────

  async listRuns(filters?: {
    organizationId?: string;
    ownerId?: string;
    status?: string;
    limit?: number;
  }): Promise<WorkflowRun[]> {
    const iris = getIrisClient();
    if (!iris) return [];

    let query = iris
      .from('workflow_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(filters?.limit || 50);

    if (filters?.organizationId) query = query.eq('organization_id', filters.organizationId);
    if (filters?.ownerId) query = query.eq('owner_id', filters.ownerId);
    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) {
      console.error('[WorkflowEngine] listRuns error:', error);
      return [];
    }

    return (data || []) as WorkflowRun[];
  }

  // ─── Get Artifact ────────────────────────────────────────────────

  async getArtifact(artifactId: string): Promise<WorkflowArtifact | null> {
    const iris = getIrisClient();
    if (!iris) return null;

    const { data, error } = await iris
      .from('workflow_artifacts')
      .select('*')
      .eq('artifact_id', artifactId)
      .single();

    if (error || !data) return null;
    return data as WorkflowArtifact;
  }

  // ─── Get Step Run ────────────────────────────────────────────────

  async getStepRun(stepRunId: string): Promise<WorkflowStepRun | null> {
    const iris = getIrisClient();
    if (!iris) return null;

    const { data } = await iris
      .from('workflow_step_runs')
      .select('*')
      .eq('step_run_id', stepRunId)
      .single();

    return data as WorkflowStepRun | null;
  }

  // ─── Update Run Context ──────────────────────────────────────────

  async updateRunContext(runId: string, contextUpdate: Record<string, any>): Promise<void> {
    const iris = getIrisClient();
    if (!iris) return;

    const { data: run } = await iris
      .from('workflow_runs')
      .select('context_data')
      .eq('run_id', runId)
      .single();

    if (!run) return;

    const merged = { ...run.context_data, ...contextUpdate };
    await iris
      .from('workflow_runs')
      .update({ context_data: merged, updated_at: new Date().toISOString() })
      .eq('run_id', runId);
  }

  // ─── Link Opportunity to Run ─────────────────────────────────────

  async linkOpportunity(runId: string, opportunityId: string): Promise<void> {
    const iris = getIrisClient();
    if (!iris) return;

    await iris
      .from('workflow_runs')
      .update({ opportunity_id: opportunityId, updated_at: new Date().toISOString() })
      .eq('run_id', runId);
  }

  // ─── SLA Breach Check (called by polling interval) ───────────────

  async checkSLABreaches(): Promise<SLABreach[]> {
    const iris = getIrisClient();
    if (!iris) return [];

    try {
      const { data: breachedSteps, error } = await iris
        .from('workflow_step_runs')
        .select('*, run:workflow_runs(*, definition:workflow_definitions(name))')
        .in('status', ['in_progress', 'awaiting_approval'])
        .is('escalated_at', null)
        .lt('sla_due_at', new Date().toISOString())
        .not('sla_due_at', 'is', null);

      if (error || !breachedSteps) return [];

      const breaches: SLABreach[] = [];

      for (const step of breachedSteps) {
        const run = step.run as any;
        if (!run || run.status !== 'active') continue;

        // Mark as escalated
        await iris
          .from('workflow_step_runs')
          .update({ escalated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('step_run_id', step.step_run_id);

        breaches.push({
          step_run_id: step.step_run_id,
          run_id: step.run_id,
          step_key: step.step_key,
          sla_due_at: step.sla_due_at,
          assigned_to: step.assigned_to,
          workflow_name: (run.definition as any)?.name || 'Workflow',
        });
      }

      if (breaches.length > 0) {
        console.log(`[WorkflowEngine] SLA breaches found: ${breaches.length}`);
      }

      return breaches;
    } catch (err) {
      console.error('[WorkflowEngine] checkSLABreaches error:', err);
      return [];
    }
  }

  // ─── Cancel a Run ────────────────────────────────────────────────

  async cancelRun(runId: string, reason?: string): Promise<boolean> {
    const iris = getIrisClient();
    if (!iris) return false;

    const { error } = await iris
      .from('workflow_runs')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        context_data: reason ? { cancel_reason: reason } : undefined,
      })
      .eq('run_id', runId);

    if (error) {
      console.error('[WorkflowEngine] cancelRun error:', error);
      return false;
    }

    // Cancel all pending/in_progress steps
    await iris
      .from('workflow_step_runs')
      .update({ status: 'skipped', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('run_id', runId)
      .in('status', ['pending', 'in_progress', 'awaiting_approval']);

    console.log(`[WorkflowEngine] Run cancelled: ${runId}`);
    return true;
  }
}
