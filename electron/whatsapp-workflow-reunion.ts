/**
 * Reunion Workflow Adapter — WhatsApp ↔ WorkflowEngine Bridge
 *
 * Bridges the WhatsApp conversational interface with the generic WorkflowEngine.
 * Handles trigger detection, extraction, and conversational HITL approval flow.
 */
import { WhatsAppService } from './whatsapp-service';
import { WorkflowEngine, type WorkflowRun, type WorkflowStepRun } from './workflow-engine';
import { WorkflowAIService, type ArtifactContext } from './workflow-ai-service';
import { CRMService } from './crm-service';

// ─── Types ───────────────────────────────────────────────────────────

interface ActiveReunionFlow {
  runId: string;
  traceId: string;
  jid: string;
  senderNumber: string;
  state: 'extracting' | 'awaiting_extraction_approval' | 'creating_crm' |
         'generating_artifacts' | 'awaiting_artifact_approvals' | 'completed';
  pendingArtifactIds: string[];
  approvedArtifactIds: string[];
  extractionData?: any;
  opportunityId?: string;
}

// ─── Trigger Detection ───────────────────────────────────────────────

const REUNION_TRIGGERS = [
  '/reunion', '/reunión', '/registrar reunion', '/registrar reunión',
  '/soflia registrar reunion', '/soflia registrar reunión',
  '/meeting', '/registro reunión', '/registro reunion',
];

const REUNION_PATTERNS = [
  /registrar\s+(la\s+)?reuni[oó]n/i,
  /tuve\s+(una\s+)?reuni[oó]n/i,
  /acabo\s+de\s+(tener\s+)?(una\s+)?reuni[oó]n/i,
  /notas?\s+de\s+(la\s+)?reuni[oó]n/i,
  /reuni[oó]n\s+con\s+/i,
  /meeting\s+with\s+/i,
  /registro\s+de\s+reuni[oó]n/i,
];

export function isReunionTrigger(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (REUNION_TRIGGERS.some(t => lower.startsWith(t))) return true;
  if (REUNION_PATTERNS.some(p => p.test(lower))) return true;
  return false;
}

// ─── Approval Keywords ───────────────────────────────────────────────

const APPROVAL_WORDS = ['si', 'sí', 'ok', 'bien', 'adelante', 'perfecto', 'correcto', 'aprobar', 'aprobado', 'generar', 'hazlo', 'dale', 'va', 'listo'];
const REJECTION_WORDS = ['no', 'cancela', 'cancelar', 'detener', 'parar', 'rechazar'];
const SKIP_WORDS = ['saltar', 'skip', 'omitir', 'siguiente', 'next'];

function parseApproval(text: string): 'approve' | 'reject' | 'skip' | null {
  const lower = text.toLowerCase().trim();
  if (APPROVAL_WORDS.some(w => lower === w || lower.startsWith(w + ' '))) return 'approve';
  if (REJECTION_WORDS.some(w => lower === w || lower.startsWith(w + ' '))) return 'reject';
  if (SKIP_WORDS.some(w => lower === w || lower.startsWith(w + ' '))) return 'skip';
  return null;
}

// ─── Reunion Workflow Adapter ────────────────────────────────────────

export class ReunionWorkflowAdapter {
  private activeFlows: Map<string, ActiveReunionFlow> = new Map(); // sessionKey → flow

  constructor(
    private engine: WorkflowEngine,
    private aiService: WorkflowAIService | null,
    private waService: WhatsAppService,
    private crmService: CRMService
  ) {
    console.log('[ReunionWorkflow] Adapter initialized');
  }

  setAIService(ai: WorkflowAIService): void {
    this.aiService = ai;
  }

  hasActiveFlow(sessionKey: string): boolean {
    return this.activeFlows.has(sessionKey);
  }

  // ─── Start Flow from WhatsApp ────────────────────────────────────

  async startFromWhatsApp(
    sessionKey: string,
    jid: string,
    senderNumber: string,
    rawText: string,
    userId: string,
    organizationId?: string
  ): Promise<string | null> {
    if (!this.aiService) {
      await this.waService.sendText(jid, 'El servicio de IA no está disponible. Verifica la API key.');
      return null;
    }

    // Start workflow run
    const run = await this.engine.startRun({
      definitionSlug: 'meeting_followup',
      triggeredBy: userId,
      triggerType: 'whatsapp',
      triggerRef: `wa:${senderNumber}:${Date.now()}`,
      initialContext: { raw_input: rawText, source_type: 'whatsapp_note' },
      organizationId,
    });

    if (!run) {
      await this.waService.sendText(jid, 'No se pudo iniciar el flujo de reunión. Verifica que el workflow esté configurado.');
      return null;
    }

    const flow: ActiveReunionFlow = {
      runId: run.run_id,
      traceId: run.trace_id,
      jid,
      senderNumber,
      state: 'extracting',
      pendingArtifactIds: [],
      approvedArtifactIds: [],
    };
    this.activeFlows.set(sessionKey, flow);

    await this.waService.sendText(jid,
      '📋 *Flujo de Reunión Iniciado*\n\n' +
      '⏳ Analizando la información de la reunión...\n' +
      'Extraeré los datos clave y te los presentaré para revisión.'
    );

    // Run extraction in background
    this.runExtraction(sessionKey, run, rawText, userId).catch(err => {
      console.error('[ReunionWorkflow] Extraction error:', err);
      this.waService.sendText(jid, '❌ Error al extraer datos de la reunión. Intenta de nuevo.');
      this.activeFlows.delete(sessionKey);
    });

    return run.run_id;
  }

  // ─── Run AI Extraction ───────────────────────────────────────────

  private async runExtraction(
    sessionKey: string,
    run: WorkflowRun,
    rawText: string,
    userId: string
  ): Promise<void> {
    const flow = this.activeFlows.get(sessionKey);
    if (!flow || !this.aiService) return;

    // Get the extract step run
    const runStatus = await this.engine.getRunStatus(run.run_id);
    if (!runStatus) return;
    const extractStep = runStatus.steps.find(s => s.step_key === 'extract');
    if (!extractStep) return;

    // Extract entities
    const { extraction, promptHash, modelUsed } = await this.aiService.extractMeetingEntities(
      rawText, 'whatsapp_note'
    );

    // QA check
    const qaResult = await this.aiService.qaCheck(
      JSON.stringify(extraction), 'entity_extraction', rawText
    );

    // Save artifact
    const artifact = await this.engine.saveArtifact({
      stepRunId: extractStep.step_run_id,
      runId: run.run_id,
      traceId: run.trace_id,
      artifactType: 'entity_extraction',
      aiOutputRaw: JSON.stringify(extraction, null, 2),
      promptHash,
      modelUsed,
      qaResult,
      createdBy: userId,
    });

    if (!artifact) return;

    flow.extractionData = extraction;
    flow.state = 'awaiting_extraction_approval';
    flow.pendingArtifactIds = [artifact.artifact_id];

    // Format extraction for WhatsApp
    let message = '📊 *Datos Extraídos de la Reunión*\n\n';
    message += `🏢 *Empresa:* ${extraction.company.name || 'No identificada'}`;
    if (extraction.company.industry) message += ` (${extraction.company.industry})`;
    message += '\n';
    message += `👤 *Contacto:* ${extraction.contact.full_name || 'No identificado'}`;
    if (extraction.contact.role_title) message += ` — ${extraction.contact.role_title}`;
    message += '\n';
    if (extraction.contact.email) message += `📧 *Email:* ${extraction.contact.email}\n`;
    if (extraction.contact.phone) message += `📱 *Tel:* ${extraction.contact.phone}\n`;
    message += '\n';

    if (extraction.pains.length > 0) {
      message += `🎯 *Necesidades:*\n${extraction.pains.map(p => `  • ${p}`).join('\n')}\n\n`;
    }
    if (extraction.objections.length > 0) {
      message += `⚠️ *Objeciones:*\n${extraction.objections.map(o => `  • ${o}`).join('\n')}\n\n`;
    }
    message += `💡 *Intención:* ${extraction.intention}\n`;
    if (extraction.budget) message += `💰 *Presupuesto:* ${extraction.budget}\n`;
    message += `➡️ *Siguiente paso:* ${extraction.next_step}\n\n`;
    message += `📝 *Resumen:* ${extraction.summary}\n\n`;

    if (extraction.missing_critical.length > 0) {
      message += `⚠️ *Datos faltantes:* ${extraction.missing_critical.join(', ')}\n\n`;
    }

    if (qaResult && !qaResult.passed) {
      message += `🔍 *Alertas QA:*\n${qaResult.issues.map(i => `  ⚠ ${i}`).join('\n')}\n\n`;
    }

    message += '¿Los datos son correctos?\n';
    message += '• *"Sí"* para aprobar y continuar\n';
    message += '• *"No"* para cancelar\n';
    message += '• O envía correcciones en texto libre';

    await this.waService.sendText(flow.jid, message);
  }

  // ─── Handle Incoming WhatsApp Message ────────────────────────────

  async handleInput(sessionKey: string, text: string, userId: string): Promise<boolean> {
    const flow = this.activeFlows.get(sessionKey);
    if (!flow) return false;

    // Extraction approval
    if (flow.state === 'awaiting_extraction_approval') {
      return this.handleExtractionApproval(sessionKey, text, userId);
    }

    // Artifact approvals
    if (flow.state === 'awaiting_artifact_approvals') {
      return this.handleArtifactApproval(sessionKey, text, userId);
    }

    // Still processing
    if (flow.state === 'extracting' || flow.state === 'creating_crm' || flow.state === 'generating_artifacts') {
      await this.waService.sendText(flow.jid, '⏳ Procesando... por favor espera un momento.');
      return true;
    }

    return false;
  }

  // ─── Handle Extraction Approval ──────────────────────────────────

  private async handleExtractionApproval(sessionKey: string, text: string, userId: string): Promise<boolean> {
    const flow = this.activeFlows.get(sessionKey);
    if (!flow) return false;

    const decision = parseApproval(text);

    if (decision === 'approve') {
      // Approve the extraction artifact
      const artifactId = flow.pendingArtifactIds[0];
      if (artifactId) {
        await this.engine.submitApproval({
          artifactId,
          decision: 'approved',
          approvedBy: userId,
        });
      }

      flow.state = 'creating_crm';
      await this.waService.sendText(flow.jid, '✅ Datos aprobados. Creando prospecto y generando artefactos...');

      // Create CRM records and generate artifacts in background
      this.createCRMAndGenerateArtifacts(sessionKey, userId).catch(err => {
        console.error('[ReunionWorkflow] CRM/generation error:', err);
        this.waService.sendText(flow.jid, '❌ Error en el procesamiento. El flujo fue registrado parcialmente.');
      });

      return true;
    }

    if (decision === 'reject') {
      await this.engine.cancelRun(flow.runId, 'Cancelado por usuario vía WhatsApp');
      await this.waService.sendText(flow.jid, '❌ Flujo cancelado.');
      this.activeFlows.delete(sessionKey);
      return true;
    }

    // Text input = corrections (treat as edited approval)
    const artifactId = flow.pendingArtifactIds[0];
    if (artifactId) {
      await this.engine.submitApproval({
        artifactId,
        decision: 'approved',
        humanEdit: text,
        reason: 'Correcciones aplicadas vía WhatsApp',
        approvedBy: userId,
      });
    }

    flow.state = 'creating_crm';
    await this.waService.sendText(flow.jid, '✅ Correcciones registradas. Creando prospecto y generando artefactos...');

    this.createCRMAndGenerateArtifacts(sessionKey, userId).catch(err => {
      console.error('[ReunionWorkflow] CRM/generation error:', err);
    });

    return true;
  }

  // ─── Create CRM Records + Generate Artifacts ────────────────────

  private async createCRMAndGenerateArtifacts(sessionKey: string, userId: string): Promise<void> {
    const flow = this.activeFlows.get(sessionKey);
    if (!flow || !flow.extractionData || !this.aiService) return;

    const extraction = flow.extractionData;

    // Create CRM records
    try {
      const companyResult = await this.crmService.findOrCreateCompany({
        name: extraction.company.name,
        domain: extraction.company.domain,
        industry: extraction.company.industry,
        createdBy: userId,
      });

      const contactResult = await this.crmService.findOrCreateContact({
        fullName: extraction.contact.full_name,
        email: extraction.contact.email,
        phone: extraction.contact.phone,
        roleTitle: extraction.contact.role_title,
        companyId: companyResult.company.company_id,
        createdBy: userId,
      });

      const opportunity = await this.crmService.createOpportunity({
        title: `Oportunidad - ${extraction.company.name}`,
        companyId: companyResult.company.company_id,
        contactId: contactResult.contact.contact_id,
        pains: extraction.pains,
        objections: extraction.objections,
        nextStep: extraction.next_step,
        createdBy: userId,
      });

      flow.opportunityId = opportunity.opportunity_id;
      await this.engine.linkOpportunity(flow.runId, opportunity.opportunity_id);

      // Log interaction
      await this.crmService.logInteraction({
        opportunityId: opportunity.opportunity_id,
        contactId: contactResult.contact.contact_id,
        interactionType: 'meeting',
        channel: 'whatsapp_hub',
        rawInput: JSON.stringify(extraction),
        aiSummary: extraction.summary,
        extractedData: extraction,
        traceId: flow.traceId,
        createdBy: userId,
      });

      // Complete the create_crm step
      await this.engine.tryAdvanceWorkflow(flow.runId);

    } catch (err) {
      console.error('[ReunionWorkflow] CRM creation error:', err);
    }

    // Generate artifacts in parallel
    flow.state = 'generating_artifacts';
    const runStatus = await this.engine.getRunStatus(flow.runId);
    if (!runStatus) return;

    const artifactContext: ArtifactContext = {
      extraction,
      rawInput: (runStatus.run.context_data as any)?.raw_input || '',
      companyName: extraction.company.name,
      contactName: extraction.contact.full_name,
    };

    const generationSteps = ['gen_email', 'gen_whatsapp', 'gen_tasks', 'gen_agenda', 'gen_proposal'];
    const artifactTypeMap: Record<string, string> = {
      gen_email: 'email_draft',
      gen_whatsapp: 'whatsapp_message',
      gen_tasks: 'iris_task',
      gen_agenda: 'meeting_agenda',
      gen_proposal: 'proposal_brief',
    };

    const generationPromises = generationSteps.map(async (stepKey) => {
      const stepRun = runStatus.steps.find(s => s.step_key === stepKey);
      if (!stepRun) {
        // Step might not be created yet, wait for workflow advance
        await new Promise(r => setTimeout(r, 1000));
        const refreshed = await this.engine.getRunStatus(flow.runId);
        const sr = refreshed?.steps.find(s => s.step_key === stepKey);
        if (!sr) return;
        return this.generateSingleArtifact(sr, flow, artifactContext, artifactTypeMap[stepKey], userId);
      }
      return this.generateSingleArtifact(stepRun, flow, artifactContext, artifactTypeMap[stepKey], userId);
    });

    await Promise.allSettled(generationPromises);

    // Show summary
    flow.state = 'awaiting_artifact_approvals';
    await this.waService.sendText(flow.jid,
      '📦 *Artefactos Generados*\n\n' +
      '✉️ Email de seguimiento\n' +
      '💬 Mensaje WhatsApp\n' +
      '📋 Tareas IRIS\n' +
      '📅 Agenda siguiente reunión\n' +
      '📄 Brief de propuesta\n\n' +
      'Todos están pendientes de aprobación en el *Inbox de SofLIA Hub*.\n' +
      'También puedes aprobar aquí respondiendo:\n' +
      '• *"aprobar todos"* para aprobar todo\n' +
      '• *"cancelar"* para cancelar el flujo'
    );
  }

  // ─── Generate Single Artifact ────────────────────────────────────

  private async generateSingleArtifact(
    stepRun: WorkflowStepRun,
    flow: ActiveReunionFlow,
    context: ArtifactContext,
    artifactType: string,
    userId: string
  ): Promise<void> {
    if (!this.aiService) return;

    try {
      let generated;
      switch (artifactType) {
        case 'email_draft':
          generated = await this.aiService.generateEmailDraft(context);
          break;
        case 'whatsapp_message':
          generated = await this.aiService.generateWhatsAppMessage(context);
          break;
        case 'iris_task':
          generated = await this.aiService.generateIRISTasks(context);
          break;
        case 'meeting_agenda':
          generated = await this.aiService.generateMeetingAgenda(context);
          break;
        case 'proposal_brief':
          generated = await this.aiService.generateProposalBrief(context);
          break;
        default:
          return;
      }

      const qaResult = await this.aiService.qaCheck(
        generated.content, artifactType, context.rawInput
      );

      const artifact = await this.engine.saveArtifact({
        stepRunId: stepRun.step_run_id,
        runId: flow.runId,
        traceId: flow.traceId,
        artifactType,
        aiOutputRaw: generated.content,
        promptHash: generated.prompt_hash,
        modelUsed: generated.model_used,
        qaResult,
        createdBy: userId,
      });

      if (artifact) {
        flow.pendingArtifactIds.push(artifact.artifact_id);
      }
    } catch (err) {
      console.error(`[ReunionWorkflow] Error generating ${artifactType}:`, err);
    }
  }

  // ─── Handle Artifact Approval via WhatsApp ───────────────────────

  private async handleArtifactApproval(sessionKey: string, text: string, userId: string): Promise<boolean> {
    const flow = this.activeFlows.get(sessionKey);
    if (!flow) return false;

    const lower = text.toLowerCase().trim();

    // Approve all
    if (lower.includes('aprobar todos') || lower.includes('aprobar todo') || lower === 'aprobar') {
      for (const artifactId of flow.pendingArtifactIds) {
        await this.engine.submitApproval({
          artifactId,
          decision: 'approved',
          approvedBy: userId,
          reason: 'Aprobación masiva vía WhatsApp',
        });
        flow.approvedArtifactIds.push(artifactId);
      }
      flow.pendingArtifactIds = [];
      flow.state = 'completed';

      await this.waService.sendText(flow.jid,
        '✅ *Todos los artefactos aprobados*\n\n' +
        'El flujo de reunión ha sido completado.\n' +
        'Los artefactos se ejecutarán según la configuración:\n' +
        '• Tareas creadas en IRIS\n' +
        '• Borradores de email y WhatsApp listos\n' +
        '• Agenda y propuesta guardadas'
      );

      this.activeFlows.delete(sessionKey);
      return true;
    }

    // Cancel
    if (REJECTION_WORDS.some(w => lower === w || lower.startsWith(w))) {
      await this.engine.cancelRun(flow.runId, 'Cancelado por usuario');
      await this.waService.sendText(flow.jid, '❌ Flujo cancelado. Los artefactos generados se descartan.');
      this.activeFlows.delete(sessionKey);
      return true;
    }

    await this.waService.sendText(flow.jid,
      'Responde:\n• *"aprobar todos"* para aprobar\n• *"cancelar"* para descartar\n\nO revisa los artefactos en el *Inbox de SofLIA Hub* para aprobar individualmente.'
    );
    return true;
  }

  // ─── End Flow ────────────────────────────────────────────────────

  endFlow(sessionKey: string): void {
    this.activeFlows.delete(sessionKey);
  }
}
