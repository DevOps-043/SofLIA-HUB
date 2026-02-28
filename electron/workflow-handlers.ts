/**
 * Workflow + CRM IPC Handlers
 *
 * Registers all IPC handlers for workflow engine and CRM operations.
 * Follows the pattern of monitoring-handlers.ts, calendar-handlers.ts, etc.
 */
import { ipcMain, BrowserWindow } from 'electron';
import { WorkflowEngine } from './workflow-engine';
import { CRMService } from './crm-service';
import { WorkflowAIService } from './workflow-ai-service';
import { DriveTranscriptWatcher } from './drive-transcript-watcher';

export function registerWorkflowHandlers(
  engine: WorkflowEngine,
  crm: CRMService,
  getAIService: () => WorkflowAIService | null,
  getMainWindow: () => BrowserWindow | null,
  transcriptWatcher?: DriveTranscriptWatcher,
): void {

  // ─── Workflow Operations ─────────────────────────────────────────

  ipcMain.handle('workflow:start-run', async (_e, params: {
    definitionSlug: string;
    triggeredBy: string;
    triggerType: string;
    triggerRef?: string;
    initialContext: Record<string, any>;
    organizationId?: string;
  }) => {
    try {
      const run = await engine.startRun(params);
      return { success: true, run };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workflow:get-run', async (_e, runId: string) => {
    try {
      const result = await engine.getRunStatus(runId);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workflow:get-pending-approvals', async (_e, filters?: any) => {
    try {
      const approvals = await engine.getPendingApprovals(filters);
      return { success: true, approvals };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workflow:submit-approval', async (_e, params: {
    artifactId: string;
    decision: 'approved' | 'rejected' | 'changes_requested' | 'more_context';
    reason?: string;
    humanEdit?: string;
    approvedBy: string;
    roleAtTime?: string;
    evidenceLinks?: string[];
  }) => {
    try {
      const result = await engine.submitApproval(params);
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workflow:get-artifact', async (_e, artifactId: string) => {
    try {
      const artifact = await engine.getArtifact(artifactId);
      return { success: true, artifact };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workflow:list-runs', async (_e, filters?: any) => {
    try {
      const runs = await engine.listRuns(filters);
      return { success: true, runs };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workflow:cancel-run', async (_e, runId: string, reason?: string) => {
    try {
      const success = await engine.cancelRun(runId, reason);
      return { success };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workflow:run-extraction', async (_e, params: {
    runId: string;
    stepRunId: string;
    traceId: string;
    rawInput: string;
    sourceType: string;
    createdBy: string;
  }) => {
    const ai = getAIService();
    if (!ai) return { success: false, error: 'AI service no disponible (falta API key)' };

    try {
      // Extract entities
      const { extraction, promptHash, modelUsed } = await ai.extractMeetingEntities(
        params.rawInput, params.sourceType
      );

      // Run QA
      const qaResult = await ai.qaCheck(
        JSON.stringify(extraction), 'entity_extraction', params.rawInput
      );

      // Save as artifact
      const artifact = await engine.saveArtifact({
        stepRunId: params.stepRunId,
        runId: params.runId,
        traceId: params.traceId,
        artifactType: 'entity_extraction',
        aiOutputRaw: JSON.stringify(extraction, null, 2),
        promptHash,
        modelUsed,
        qaResult,
        createdBy: params.createdBy,
      });

      return { success: true, artifact, extraction, qaResult };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workflow:generate-artifact', async (_e, params: {
    runId: string;
    stepRunId: string;
    traceId: string;
    artifactType: string;
    context: any;
    createdBy: string;
  }) => {
    const ai = getAIService();
    if (!ai) return { success: false, error: 'AI service no disponible (falta API key)' };

    try {
      let generated;
      const ctx = params.context;

      switch (params.artifactType) {
        case 'email_draft':
          generated = await ai.generateEmailDraft(ctx);
          break;
        case 'whatsapp_message':
          generated = await ai.generateWhatsAppMessage(ctx);
          break;
        case 'iris_task':
          generated = await ai.generateIRISTasks(ctx);
          break;
        case 'meeting_agenda':
          generated = await ai.generateMeetingAgenda(ctx);
          break;
        case 'proposal_brief':
          generated = await ai.generateProposalBrief(ctx);
          break;
        default:
          return { success: false, error: `Tipo de artefacto no soportado: ${params.artifactType}` };
      }

      // Run QA
      const qaResult = await ai.qaCheck(
        generated.content, params.artifactType, ctx.rawInput || ''
      );

      // Save artifact
      const artifact = await engine.saveArtifact({
        stepRunId: params.stepRunId,
        runId: params.runId,
        traceId: params.traceId,
        artifactType: params.artifactType,
        aiOutputRaw: generated.content,
        promptHash: generated.prompt_hash,
        modelUsed: generated.model_used,
        qaResult,
        createdBy: params.createdBy,
      });

      return { success: true, artifact, generated: generated.metadata, qaResult };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── CRM Operations ─────────────────────────────────────────────

  ipcMain.handle('crm:get-opportunities', async (_e, filters?: any) => {
    try {
      const opportunities = await crm.getOpportunities(filters);
      return { success: true, opportunities };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('crm:get-company', async (_e, companyId: string) => {
    try {
      const result = await crm.getCompanyWithContacts(companyId);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('crm:search-contacts', async (_e, query: string, orgId?: string) => {
    try {
      const contacts = await crm.searchContacts(query, orgId);
      return { success: true, contacts };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('crm:update-opportunity-stage', async (_e, oppId: string, stage: string, reason?: string) => {
    try {
      const opp = await crm.updateOpportunityStage(oppId, stage as any, reason);
      return { success: true, opportunity: opp };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('crm:log-interaction', async (_e, params: any) => {
    try {
      const interaction = await crm.logInteraction(params);
      return { success: true, interaction };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('crm:get-pipeline', async (_e, organizationId?: string) => {
    try {
      const pipeline = await crm.getPipelineSummary(organizationId);
      return { success: true, pipeline };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('crm:find-or-create-company', async (_e, params: any) => {
    try {
      const result = await crm.findOrCreateCompany(params);
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('crm:find-or-create-contact', async (_e, params: any) => {
    try {
      const result = await crm.findOrCreateContact(params);
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('crm:create-opportunity', async (_e, params: any) => {
    try {
      const opportunity = await crm.createOpportunity(params);
      return { success: true, opportunity };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Forward Events to Renderer ──────────────────────────────────

  engine.on('approval:needed', (data) => {
    getMainWindow()?.webContents.send('workflow:approval-needed', data);
  });

  engine.on('sla:breach', (data) => {
    getMainWindow()?.webContents.send('workflow:sla-breach', data);
  });

  engine.on('run:completed', (data) => {
    getMainWindow()?.webContents.send('workflow:run-completed', data);
  });

  engine.on('step:started', (data) => {
    getMainWindow()?.webContents.send('workflow:step-started', data);
  });

  engine.on('step:completed', (data) => {
    getMainWindow()?.webContents.send('workflow:step-completed', data);
  });

  // ─── Transcript Watcher Operations ─────────────────────────────

  if (transcriptWatcher) {
    ipcMain.handle('transcript:get-config', async () => {
      try {
        return { success: true, config: transcriptWatcher.getConfig() };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('transcript:update-config', async (_e, updates: any) => {
      try {
        await transcriptWatcher.updateConfig(updates);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('transcript:force-scan', async () => {
      try {
        const result = await transcriptWatcher.forceScan();
        return { success: true, ...result };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('transcript:get-processed', async () => {
      try {
        return { success: true, files: transcriptWatcher.getProcessedFiles() };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('transcript:get-status', async () => {
      try {
        return { success: true, ...transcriptWatcher.getStatus() };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });
  }

  console.log('[WorkflowHandlers] Registered all workflow + CRM IPC handlers');
}
