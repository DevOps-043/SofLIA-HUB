/**
 * WhatsApp Agent — Main-process Gemini agentic loop for WhatsApp messages.
 * Uses executeToolDirect() to call computer-use tools without IPC.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { WhatsAppService } from './whatsapp-service';
import type { CalendarService } from './calendar-service';
import type { GmailService } from './gmail-service';
import type { DriveService } from './drive-service';
import type { GChatService } from './gchat-service';
import type { MemoryService } from './memory-service';
import type { KnowledgeService } from './knowledge-service';
import type { DesktopAgentService } from './desktop-agent-service';
import type { ClipboardAIAssistant } from './clipboard-ai-assistant';
import type { TaskScheduler } from './task-scheduler';
import type { NeuralOrganizerService } from './neural-organizer';
import { SmartSearchTool } from './smart-search-tool';
import type { WorkspaceAutomationService, WorkflowRunRecord } from './workspace-automation-service';
import {
  tryAutoAuthByPhone,
  getWhatsAppSession,
  buildIrisContextForWhatsApp,
  needsIrisData,
  isIrisAvailable,
} from './iris-data-main';

import type { MeetingWorkflowService } from './meetings/meeting-workflow-service';
import { WorkflowManager } from './whatsapp-workflow-presentacion';
import { MeetingWorkflowManager } from './whatsapp-workflow-meetings';
import { WA_TOOL_DECLARATIONS, GROUP_BLOCKED_TOOLS } from './whatsapp-tools';
import { buildSystemPrompt, detectActionRequest, formatForWhatsApp } from './whatsapp-prompts';
import { executeWhatsAppTools, type ToolExecutorContext } from './whatsapp-tool-executor';
import { dynamicToolService } from './dynamic-tool-service';

// ─── [EXTRACTED] Tool definitions → ./whatsapp-tools.ts ─────
// ─── [EXTRACTED] Prompts + helpers → ./whatsapp-prompts.ts ──
// ─── [EXTRACTED] Tool executor → ./whatsapp-tool-executor.ts ─

// ─── Conversation history per session (DM: by number, Group: by group+number) ──
const MAX_HISTORY = 20;
const conversations = new Map<string, Array<{ role: string; parts: Array<{ text: string }> }>>();

// ─── Pending confirmations ──────────────────────────────────────────
interface PendingConfirmation {
  toolName: string;
  args: Record<string, any>;
  resolve: (confirmed: boolean) => void;
  timeout: ReturnType<typeof setTimeout>;
}
const pendingConfirmations = new Map<string, PendingConfirmation>();

// ─── Model selection: prefer stable models for main process ─────────
const WA_MODEL = 'gemini-2.5-flash';

const LOOP_GUARD_REPEAT_THRESHOLD = 3;
const LOOP_GUARD_CRITICAL_THRESHOLD = 5;
const POLL_LIKE_TOOLS = new Set([
  'poll_process_session',
  'list_process_sessions',
  'list_active_tasks',
  'autodev_status',
  'get_background_host_status',
]);

interface ToolLoopTraceEntry {
  iteration: number;
  toolSignature: string;
  responseSignature: string;
  toolNames: string[];
  hadFailure: boolean;
}

function sortKeysDeep(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort((a, b) => a.localeCompare(b))
      .reduce<Record<string, any>>((acc, key) => {
        acc[key] = sortKeysDeep(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function stableJson(value: any): string {
  try {
    return JSON.stringify(sortKeysDeep(value));
  } catch {
    return String(value);
  }
}

function summarizeFunctionResponses(functionResponses: Array<{ functionResponse: { name: string; response: any } }>): Array<Record<string, any>> {
  return functionResponses.map(({ functionResponse }) => {
    const response = functionResponse.response || {};
    const summary: Record<string, any> = {
      name: functionResponse.name,
    };

    if (typeof response.success === 'boolean') {
      summary.success = response.success;
    }
    if (typeof response.error === 'string') {
      summary.error = response.error;
    }
    if (typeof response.message === 'string') {
      summary.message = response.message;
    }
    if (typeof response.status === 'string') {
      summary.status = response.status;
    }
    if (typeof response.session_status === 'string') {
      summary.session_status = response.session_status;
    }
    if (typeof response.count === 'number') {
      summary.count = response.count;
    }
    if (typeof response.pid === 'number') {
      summary.pid = response.pid;
    }
    if (typeof response.session_id === 'string') {
      summary.session_id = response.session_id;
    }

    return summary;
  });
}



export class WhatsAppAgent {
  private genAI: GoogleGenerativeAI | null = null;
  private waService: WhatsAppService;
  private apiKey: string;
  private calendarService: CalendarService | null = null;
  private gmailService: GmailService | null = null;
  private driveService: DriveService | null = null;
  private gchatService: GChatService | null = null;
  private desktopAgent: DesktopAgentService | null = null;
  private clipboardAssistant: ClipboardAIAssistant | null = null;
  private taskScheduler: TaskScheduler | null = null;
  private neuralOrganizer: NeuralOrganizerService | null = null;
  private smartSearch: SmartSearchTool | null = null;
  private meetingWorkflowService: MeetingWorkflowService | null = null;
  private workspaceAutomationService: WorkspaceAutomationService | null = null;
  private memory: MemoryService;
  private knowledge: KnowledgeService;

  constructor(waService: WhatsAppService, apiKey: string, memoryService: MemoryService, knowledgeService: KnowledgeService) {
    this.waService = waService;
    this.apiKey = apiKey;
    this.memory = memoryService;
    this.knowledge = knowledgeService;
  }

  setGoogleServices(calendar: CalendarService, gmail: GmailService, drive: DriveService, gchat?: GChatService): void {
    this.calendarService = calendar;
    this.gmailService = gmail;
    this.driveService = drive;
    this.gchatService = gchat || null;
    console.log('[WhatsApp Agent] Google services connected (Calendar, Gmail, Drive, Chat)');
  }


  setDesktopAgentService(service: DesktopAgentService): void {
    this.desktopAgent = service;
    console.log('[WhatsApp Agent] DesktopAgent service connected');
  }

  setClipboardAssistant(service: ClipboardAIAssistant): void {
    this.clipboardAssistant = service;
    console.log('[WhatsApp Agent] Clipboard AI Assistant connected');
  }

  setTaskScheduler(service: TaskScheduler): void {
    this.taskScheduler = service;
    console.log('[WhatsApp Agent] Task Scheduler connected');
  }

  setMeetingWorkflowService(service: MeetingWorkflowService): void {
    this.meetingWorkflowService = service;
    console.log('[WhatsApp Agent] Meeting workflow service connected');
  }

  setWorkspaceAutomationService(service: WorkspaceAutomationService): void {
    this.workspaceAutomationService = service;
    console.log('[WhatsApp Agent] Workspace automation service connected');
  }


  setNeuralOrganizer(service: NeuralOrganizerService): void {
    this.neuralOrganizer = service;
    console.log('[WhatsApp Agent] Neural Organizer connected');
  }

  updateApiKey(key: string) {
    this.apiKey = key;
    this.genAI = null;
  }

  public getGenAI(): GoogleGenerativeAI {
    if (!this.genAI) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
    return this.genAI;
  }

  // ─── Handle text messages ───────────────────────────────────────
  async handleMessage(
    jid: string,
    senderNumber: string,
    text: string,
    isGroup: boolean = false,
    groupPassiveHistory: string = '',
  ): Promise<void> {
    const sessionKey = isGroup ? `group:${jid}:${senderNumber}` : senderNumber;
    
    // Check for active workflow
    if (MeetingWorkflowManager.isActive(sessionKey)) {
      await MeetingWorkflowManager.handleMessage(sessionKey, text);
      return;
    }

    if (WorkflowManager.isActive(sessionKey)) {
      await WorkflowManager.handleMessage(sessionKey, text);
      return;
    }

    // Check for pending confirmation response
    const pending = pendingConfirmations.get(senderNumber);
    if (pending) {
      const lower = text.toLowerCase().trim();
      const confirmed = lower === 'si' || lower === 'sí' || lower === 'yes' || lower === 'confirmar' || lower === 'confirmo';
      clearTimeout(pending.timeout);
      pendingConfirmations.delete(senderNumber);
      pending.resolve(confirmed);
      return;
    }

    // ─── Chat commands (inspired by OpenClaw) ────────────────────
    if (text.startsWith('/')) {
      try {
        const cmdResult = await this.handleChatCommand(jid, senderNumber, text, isGroup);
        if (cmdResult) {
          await this.waService.sendText(jid, cmdResult);
          return;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'No pude ejecutar ese comando.';
        await this.waService.sendText(jid, `No pude completar ese comando.\n${message}`);
        return;
      }
      // Si se activó un workflow durante el comando, detener el procesamiento normal
      if (WorkflowManager.isActive(sessionKey) || MeetingWorkflowManager.isActive(sessionKey)) {
        return;
      }
    }

    try {
      const response = await this.runAgentLoop(jid, senderNumber, text, isGroup, groupPassiveHistory);
      if (response) {
        await this.waService.sendText(jid, response);
      }
    } catch (err: any) {
      console.error('[WhatsApp Agent] Error:', err);
      // Auto-reset conversation on error to prevent stuck loops
      const sessionKey = isGroup ? `group:${jid}:${senderNumber}` : senderNumber;
      conversations.delete(sessionKey);
      console.warn(`[WhatsApp Agent] Auto-reset conversation for ${sessionKey} after error`);
      await this.waService.sendText(jid, `Ocurrió un error. He reiniciado la conversación. Intenta de nuevo.`);
    }
  }

  // ─── Chat commands (/status, /reset, /activation, /help) ────────
  private async handleChatCommand(
    jid: string,
    senderNumber: string,
    text: string,
    isGroup: boolean,
  ): Promise<string | null> {
    const parts = text.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    const sessionKey = isGroup ? `group:${jid}:${senderNumber}` : senderNumber;

    switch (cmd) {
      case '/status':
        return `🤖 *SofLIA activa*\n• Modelo: Gemini 2.5 Flash\n• Modo: ${isGroup ? 'Grupo' : 'DM'}\n• Historial: ${conversations.get(sessionKey)?.length || 0} mensajes`;

      case '/reset':
      case '/new':
        conversations.delete(sessionKey);
        this.memory.clearSessionContext(sessionKey);
        return '🔄 Conversación reiniciada.';

      case '/activation': {
        if (!isGroup) return '⚠️ Este comando solo funciona en grupos.';
        // Security: Only administrator can change activation mode
        if (!this.waService.isAllowedNumber(senderNumber)) {
          return '❌ Solo el administrador puede cambiar el modo de activación.';
        }
        const mode = args[0]?.toLowerCase();
        if (mode === 'mention' || mode === 'always') {
          await this.waService.setGroupConfig({ groupActivation: mode });
          return `✅ Activación cambiada a: *${mode}*\n${mode === 'mention' ? '• Solo responderé cuando me mencionen, usen /soflia, o hagan reply a mi mensaje' : '• Responderé a TODOS los mensajes del grupo'}`;
        }
        return '📋 Uso: /activation mention | always';
      }

      case '/presentación':
      case '/presentacion':
        await WorkflowManager.startWorkflow(sessionKey, jid, senderNumber, this.waService, this);
        return null;

      case '/reunion':
      case '/reunión':
        if (!this.meetingWorkflowService) {
          return 'Meeting Ops no está disponible todavía.';
        }
        await MeetingWorkflowManager.startWorkflow(
          sessionKey,
          jid,
          senderNumber,
          this.waService,
          this.meetingWorkflowService,
        );
        if (args.length > 0) {
          await MeetingWorkflowManager.handleMessage(sessionKey, args.join(' '));
        }
        return null;

      case '/correo':
      case '/correos': {
        if (!this.workspaceAutomationService) {
          return 'La revisión de correo todavía no está disponible en este momento.';
        }
        if (!this.workspaceAutomationService.isConfigured()) {
          return 'Primero necesito una API key activa de Gemini para revisar correos.';
        }

        const query = this.resolveAutomationMailQuery(args);
        const run = await this.workspaceAutomationService.executeTemplate({
          templateId: 'gmail_triage',
          requestedBy: `whatsapp:${senderNumber}`,
          input: {
            query,
            maxResults: 5,
            removeFromInbox: true,
          },
        });

        return this.formatAutomationRunResponse(
          run,
          'Listo. Preparé una revisión ejecutiva de correo.',
        );
      }

      case '/agenda': {
        if (!this.workspaceAutomationService) {
          return 'La agenda ejecutiva todavía no está disponible en este momento.';
        }
        if (!this.workspaceAutomationService.isConfigured()) {
          return 'Primero necesito una API key activa de Gemini para preparar la agenda.';
        }

        const targetDate = this.resolveAutomationBriefDate(args);
        const run = await this.workspaceAutomationService.executeTemplate({
          templateId: 'calendar_daily_brief',
          requestedBy: `whatsapp:${senderNumber}`,
          input: {
            targetDate,
          },
        });

        return this.formatAutomationRunResponse(
          run,
          `Listo. Preparé tu resumen de agenda${targetDate ? ` para ${targetDate}` : ' de hoy'}.`,
        );
      }

      case '/seguimiento':
      case '/correoseguimiento': {
        if (!this.workspaceAutomationService) {
          return 'El seguimiento de correo todavia no esta disponible.';
        }
        if (!this.workspaceAutomationService.isConfigured()) {
          return 'Primero necesito una API key activa de Gemini para redactar el seguimiento.';
        }

        const raw = args.join(' ').trim();
        const parts = raw.split('|').map((item) => item.trim());
        const to = parts[0] || '';
        const topic = parts[1] || '';
        const context = parts.slice(2).join(' | ').trim();
        if (!to || !topic) {
          return 'Uso: /seguimiento correo@empresa.com | tema | contexto opcional';
        }

        const run = await this.workspaceAutomationService.executeTemplate({
          templateId: 'gmail_followup_draft',
          requestedBy: `whatsapp:${senderNumber}`,
          input: {
            to,
            topic,
            context: context || undefined,
          },
        });

        return this.formatAutomationRunResponse(
          run,
          'Listo. Deje preparado el correo de seguimiento.',
        );
      }

      case '/prepreunion':
      case '/reunionprep': {
        if (!this.workspaceAutomationService) {
          return 'La preparacion de reunion todavia no esta disponible.';
        }
        if (!this.workspaceAutomationService.isConfigured()) {
          return 'Primero necesito una API key activa de Gemini para preparar la reunion.';
        }

        const targetDate = this.resolveAutomationBriefDate(args);
        const run = await this.workspaceAutomationService.executeTemplate({
          templateId: 'calendar_meeting_prep',
          requestedBy: `whatsapp:${senderNumber}`,
          input: {
            targetDate,
          },
        });

        return this.formatAutomationRunResponse(
          run,
          `Listo. Prepare tu siguiente reunion${targetDate ? ` para ${targetDate}` : ''}.`,
        );
      }

      case '/driveproyecto': {
        if (!this.workspaceAutomationService) {
          return 'La preparacion de espacios en Drive todavia no esta disponible.';
        }

        const raw = args.join(' ').trim();
        const parts = raw.split('|').map((item) => item.trim());
        const projectName = parts[0] || '';
        const parentFolderId = parts[1] || '';
        const gchatSpace = parts[2] || '';
        if (!projectName) {
          return 'Uso: /driveproyecto Nombre del proyecto | carpetaPadre opcional | espacioChat opcional';
        }

        const run = await this.workspaceAutomationService.executeTemplate({
          templateId: 'drive_project_workspace',
          requestedBy: `whatsapp:${senderNumber}`,
          input: {
            projectName,
            parentFolderId: parentFolderId || undefined,
            gchatSpace: gchatSpace || undefined,
          },
        });

        return this.formatAutomationRunResponse(
          run,
          'Listo. Deje preparado el espacio base de Drive.',
        );
      }

      case '/chatdirectivo':
      case '/actualizacionchat': {
        if (!this.workspaceAutomationService) {
          return 'La actualizacion ejecutiva todavia no esta disponible.';
        }
        if (!this.workspaceAutomationService.isConfigured()) {
          return 'Primero necesito una API key activa de Gemini para redactar la actualizacion.';
        }

        const raw = args.join(' ').trim();
        const parts = raw.split('|').map((item) => item.trim());
        const spaceName = parts[0] || '';
        const context = parts[1] || '';
        const tone = parts[2] || '';
        if (!spaceName || !context) {
          return 'Uso: /chatdirectivo SPACE | contexto | tono opcional';
        }

        const run = await this.workspaceAutomationService.executeTemplate({
          templateId: 'gchat_executive_update',
          requestedBy: `whatsapp:${senderNumber}`,
          input: {
            spaceName,
            context,
            tone: tone || undefined,
          },
        });

        return this.formatAutomationRunResponse(
          run,
          'Listo. Deje lista la actualizacion ejecutiva para Google Chat.',
        );
      }

      case '/computadora':
      case '/pc':
      case '/escritorio': {
        if (!this.workspaceAutomationService) {
          return 'La automatizacion de computadora todavia no esta disponible.';
        }
        if (!this.workspaceAutomationService.isConfigured()) {
          return 'Primero necesito una API key activa de Gemini para preparar la accion.';
        }

        const objective = args.join(' ').trim();
        if (!objective) {
          return 'Uso: /computadora describe la accion que quieres preparar';
        }

        const run = await this.workspaceAutomationService.executeTemplate({
          templateId: 'desktop_action',
          requestedBy: `whatsapp:${senderNumber}`,
          input: {
            objective,
          },
        });

        return this.formatAutomationRunResponse(
          run,
          'Listo. Prepare una accion para tu computadora.',
        );
      }

      case '/crearflujo': {
        if (!this.workspaceAutomationService) {
          return 'La creación de flujos todavía no está disponible.';
        }
        if (!this.workspaceAutomationService.isConfigured()) {
          return 'Primero necesito una API key activa de Gemini para diseñar flujos.';
        }

        const raw = args.join(' ').trim();
        const [namePart, objectivePart] = raw.split('|').map((item) => item.trim());
        const objective = objectivePart ? objectivePart : namePart;
        const name = objectivePart ? namePart : '';
        if (!objective) {
          return 'Uso: /crearflujo Nombre | Objetivo del flujo';
        }

        const template = await this.workspaceAutomationService.createCustomTemplate({
          name: name || undefined,
          objective,
          requestedBy: `whatsapp:${senderNumber}`,
        });

        return [
          'Listo. Diseñé un nuevo flujo personalizado.',
          `ID: ${template.id}`,
          `Nombre: ${template.name}`,
          `Resumen: ${template.description}`,
          `Para usarlo: /usarflujo ${template.id} | detalle actual`,
        ].join('\n');
      }

      case '/flujos':
      case '/misflujos': {
        if (!this.workspaceAutomationService) {
          return 'La lista de flujos todavía no está disponible.';
        }
        return this.formatCustomTemplateList();
      }

      case '/usarflujo':
      case '/ejecutarflujo': {
        if (!this.workspaceAutomationService) {
          return 'La ejecución de flujos todavía no está disponible.';
        }
        const raw = args.join(' ').trim();
        const [templateIdPart, detailsPart] = raw.split('|').map((item) => item.trim());
        const templateId = templateIdPart?.split(/\s+/)[0]?.trim();
        if (!templateId) {
          return 'Uso: /usarflujo ID | detalle actual';
        }
        const run = await this.workspaceAutomationService.executeTemplate({
          templateId,
          requestedBy: `whatsapp:${senderNumber}`,
          input: {
            details: detailsPart || null,
          },
        });
        return this.formatAutomationRunResponse(
          run,
          'Listo. Preparé el flujo personalizado.',
        );
      }

      case '/pendientes': {
        if (!this.workspaceAutomationService) {
          return 'La bandeja de decisiones todavía no está disponible.';
        }
        return this.formatPendingAutomationRuns();
      }

      case '/aprobar':
      case '/autorizar': {
        if (!this.workspaceAutomationService) {
          return 'La autorización de casos todavía no está disponible.';
        }
        const runId = args[0]?.trim();
        if (!runId) {
          return 'Uso: /aprobar FOLIO comentario opcional';
        }
        const comment = args.slice(1).join(' ').trim() || null;
        const run = await this.workspaceAutomationService.approveRun(
          runId,
          `whatsapp:${senderNumber}`,
          comment,
        );
        return this.formatAutomationDecisionResponse(run, 'autorizado');
      }

      case '/rechazar':
      case '/noautorizar': {
        if (!this.workspaceAutomationService) {
          return 'La autorización de casos todavía no está disponible.';
        }
        const runId = args[0]?.trim();
        if (!runId) {
          return 'Uso: /rechazar FOLIO comentario opcional';
        }
        const comment = args.slice(1).join(' ').trim() || null;
        const run = this.workspaceAutomationService.rejectRun(
          runId,
          `whatsapp:${senderNumber}`,
          comment,
        );
        return this.formatAutomationDecisionResponse(run, 'rechazado');
      }

      case '/help':
        return `📋 *Comandos disponibles:*\n\n/status — Estado de SofLIA\n/reset — Reiniciar conversación\n/new — Igual que /reset\n/correo — Revisar un correo importante\n/correo hoy — Correos nuevos de hoy\n/correo noleidos — Correos pendientes de responder\n/agenda — Preparar agenda de hoy\n/agenda 2026-03-22 — Preparar agenda de una fecha\n/crearflujo Nombre | Objetivo — Crear un flujo propio\n/flujos — Ver flujos personalizados\n/usarflujo ID | detalle — Ejecutar un flujo personalizado\n/pendientes — Ver decisiones por autorizar\n/aprobar FOLIO — Autorizar un caso\n/rechazar FOLIO — No autorizar un caso\n/presentacion — Proceso de presentaciones\n/reunion — Proceso de reuniones\n${isGroup ? '/activation mention|always — Modo de activación en grupo (Solo Admin)\n' : ''}/help — Esta ayuda\n\n${isGroup ? '💡 En grupos, solo respondo si me etiquetas (@SofLIA), usas el prefijo /soflia, o incluyes mi nombre "soflia" en tu mensaje.' : 'Tip: usa /pendientes para revisar lo que espera tu autorización.'}`;

      default:
        // Not a recognized command, return null to let agent process it
        return null;
    }
  }

  private resolveAutomationMailQuery(args: string[]): string {
    const raw = args.join(' ').trim();
    const normalized = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (!normalized || normalized === 'hoy') {
      return 'in:inbox newer_than:1d';
    }
    if (
      normalized === 'noleidos'
      || normalized === 'no leidos'
      || normalized === 'pendientes'
      || normalized === 'sin responder'
    ) {
      return 'in:inbox is:unread newer_than:7d';
    }
    if (
      normalized === 'importantes'
      || normalized === 'clientes'
      || normalized === 'prioritarios'
    ) {
      return 'in:inbox category:primary newer_than:7d';
    }

    return raw;
  }

  private resolveAutomationBriefDate(args: string[]): string | undefined {
    const raw = args.join(' ').trim();
    if (!raw) {
      return undefined;
    }

    const normalized = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (normalized === 'hoy') {
      return this.formatDateOnly(new Date());
    }

    if (normalized === 'manana') {
      const nextDay = new Date();
      nextDay.setDate(nextDay.getDate() + 1);
      return this.formatDateOnly(nextDay);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    return undefined;
  }

  private formatPendingAutomationRuns(): string {
    const pendingRuns = this.workspaceAutomationService
      ?.listRuns(10)
      .filter((run) => run.status === 'needs_approval') || [];

    if (pendingRuns.length === 0) {
      return 'No hay decisiones pendientes por autorizar en este momento.';
    }

    return [
      '*Pendientes por autorizar*',
      ...pendingRuns.slice(0, 5).map((run, index) => {
        const pendingActions = run.actions.filter((action) => action.status === 'pending').length;
        return `${index + 1}. ${run.title}\nFolio: ${run.id}\nResumen: ${run.summary}\nAcciones pendientes: ${pendingActions}`;
      }),
      '',
      'Para autorizar: /aprobar FOLIO',
      'Para no autorizar: /rechazar FOLIO',
    ].join('\n\n');
  }

  private formatCustomTemplateList(): string {
    const templates = this.workspaceAutomationService
      ?.listTemplates()
      .filter((template) => template.kind === 'custom') || [];

    if (templates.length === 0) {
      return 'Todavía no tienes flujos personalizados. Usa /crearflujo para diseñar el primero.';
    }

    return [
      '*Tus flujos personalizados*',
      ...templates.slice(0, 8).map((template, index) => (
        `${index + 1}. ${template.name}\nID: ${template.id}\nResumen: ${template.description}`
      )),
      '',
      'Para ejecutarlo: /usarflujo ID | detalle actual',
    ].join('\n\n');
  }

  private formatAutomationRunResponse(run: WorkflowRunRecord, intro: string): string {
    const pendingActions = run.actions.filter((action) => action.status === 'pending').length;
    const nextStep = run.status === 'needs_approval'
      ? `Quedó listo para revisión con ${pendingActions} accion(es) por autorizar.`
      : 'No requiere autorización adicional.';

    return [
      intro,
      `Folio: ${run.id}`,
      `Caso: ${run.title}`,
      `Resumen: ${run.summary}`,
      nextStep,
      run.status === 'needs_approval'
        ? `Si estás de acuerdo: /aprobar ${run.id}`
        : 'Puedes usar /pendientes para revisar otros casos.',
    ].join('\n');
  }

  private formatAutomationDecisionResponse(run: WorkflowRunRecord, decision: 'autorizado' | 'rechazado'): string {
    const executedActions = run.actions.filter((action) => action.status === 'executed').length;
    const failedActions = run.actions.filter((action) => action.status === 'failed').length;
    const skippedActions = run.actions.filter((action) => action.status === 'skipped').length;

    return [
      `Caso ${decision}.`,
      `Folio: ${run.id}`,
      `Resumen: ${run.summary}`,
      executedActions > 0 ? `Acciones ejecutadas: ${executedActions}` : null,
      failedActions > 0 ? `Acciones con error: ${failedActions}` : null,
      skippedActions > 0 ? `Acciones omitidas: ${skippedActions}` : null,
      'Puedes usar /pendientes para revisar lo siguiente.',
    ].filter(Boolean).join('\n');
  }

  private formatDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  // ─── Handle media (Photos, Docs) — FULL AGENTIC PIPELINE ─────
  async handleMedia(
    jid: string,
    senderNumber: string,
    buffer: Buffer,
    fileName: string,
    mimetype: string,
    text: string,
    isGroup: boolean = false,
    groupPassiveHistory: string = '',
  ): Promise<void> {
    try {
      // ─── Step 1: Save file to disk (persistent + referenceable) ──────
      const receivedDir = path.join(app.getPath('userData'), 'whatsapp-received');
      await fs.mkdir(receivedDir, { recursive: true });

      // Sanitize filename and make unique with timestamp
      const safeName = fileName.replace(/[<>:"/\\|?*]/g, '_');
      const timestamp = Date.now();
      const ext = path.extname(safeName) || this.getExtensionFromMime(mimetype);
      const baseName = path.basename(safeName, ext);
      const savedFileName = `${baseName}_${timestamp}${ext}`;
      const savedPath = path.join(receivedDir, savedFileName);

      await fs.writeFile(savedPath, buffer);
      console.log(`[WhatsApp Agent] Saved received file: ${savedPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

      // ─── Step 2: Determine if file can be sent inline to Gemini ──────
      const MAX_INLINE_SIZE = 15 * 1024 * 1024; // 15MB binary (~20MB base64)
      const isInlineable = buffer.length <= MAX_INLINE_SIZE;
      const isAnalyzable = /^(image\/(jpeg|png|gif|webp|bmp)|application\/pdf|text\/|audio\/)/.test(mimetype);

      let inlineMediaParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
      let userText = '';

      if (isInlineable && isAnalyzable) {
        // File is small enough and in a format Gemini can analyze → send inline
        const base64Data = buffer.toString('base64');
        inlineMediaParts = [{
          inlineData: {
            mimeType: mimetype,
            data: base64Data,
          },
        }];

        userText = text && text.trim()
          ? `${text.trim()}\n\n[Archivo adjunto: "${fileName}" (${mimetype}, ${(buffer.length / 1024 / 1024).toFixed(1)} MB). Lo he guardado en: ${savedPath}. Analiza el contenido del archivo.]`
          : `[El usuario envió un archivo: "${fileName}" (${mimetype}, ${(buffer.length / 1024 / 1024).toFixed(1)} MB). Lo he guardado en: ${savedPath}. Analiza el contenido del archivo y responde.]`;
      } else {
        // File is too large or not directly analyzable — tell agent where it's saved
        const sizeInfo = `${(buffer.length / 1024 / 1024).toFixed(1)} MB`;
        const reason = !isInlineable ? `demasiado grande (${sizeInfo})` : `formato no analizable directamente (${mimetype})`;

        userText = text && text.trim()
          ? `${text.trim()}\n\n[El usuario envió un archivo: "${fileName}" (${mimetype}, ${sizeInfo}). Archivo ${reason} para análisis inline, pero lo he guardado en: ${savedPath}. Puedes usar read_file para leer su contenido si es un documento de texto, o informar al usuario dónde está guardado.]`
          : `[El usuario envió un archivo: "${fileName}" (${mimetype}, ${sizeInfo}). Archivo ${reason} para análisis inline, pero lo he guardado en: ${savedPath}. Puedes usar read_file para leer su contenido si es un documento de texto, o informar al usuario dónde está guardado.]`;

        console.log(`[WhatsApp Agent] File too large or not analyzable inline (${reason}), saved to disk only: ${savedPath}`);
      }

      console.log(`[WhatsApp Agent] Processing media: ${fileName} (${mimetype}), inline: ${isInlineable && isAnalyzable}, caption: "${text?.slice(0, 60) || 'none'}"`);

      // ─── Step 3: Run the FULL agentic loop ───────────────────────────
      const response = await this.runAgentLoop(
        jid,
        senderNumber,
        userText,
        isGroup,
        groupPassiveHistory,
        inlineMediaParts,
      );

      if (response) {
        await this.waService.sendText(jid, response);
      }
    } catch (err: any) {
      console.error('[WhatsApp Agent] Media error:', err);
      await this.waService.sendText(jid, 'No pude procesar el archivo. Intenta de nuevo o envía un mensaje de texto.');
    }
  }

  /** Get file extension from MIME type */
  private getExtensionFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
      'image/webp': '.webp', 'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.ms-powerpoint': '.ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
      'text/plain': '.txt', 'text/csv': '.csv',
      'application/zip': '.zip', 'application/x-rar-compressed': '.rar',
      'video/mp4': '.mp4', 'audio/ogg': '.ogg', 'audio/mpeg': '.mp3',
    };
    return map[mime] || '';
  }

  // ─── Handle audio messages ──────────────────────────────────────
  async handleAudio(
    jid: string,
    senderNumber: string,
    audioBuffer: Buffer,
    isGroup: boolean = false,
    groupPassiveHistory: string = '',
  ): Promise<void> {
    try {
      const transcription = await this.transcribeAudio(audioBuffer);

      if (!transcription || !transcription.trim()) {
        await this.waService.sendText(jid, 'No pude entender el audio. ¿Podrías repetirlo o escribirlo?');
        return;
      }

      console.log(`[WhatsApp Agent] Audio transcribed: "${transcription}"`);
      await this.handleMessage(jid, senderNumber, transcription, isGroup, groupPassiveHistory);
    } catch (err: any) {
      console.error('[WhatsApp Agent] Audio error:', err);
      await this.waService.sendText(jid, 'No pude procesar el audio. Intenta enviar un mensaje de texto.');
    }
  }

  // ─── Transcribe audio with Gemini ───────────────────────────────
  private async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const ai = this.getGenAI();
    const model = ai.getGenerativeModel({ model: WA_MODEL });

    const base64Audio = audioBuffer.toString('base64');

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'audio/ogg',
          data: base64Audio,
        },
      },
      'Transcribe este audio a texto. Solo devuelve la transcripción exacta de lo que dice la persona, sin agregar nada más. Si no puedes entenderlo, responde con una cadena vacía.',
    ]);

    return result.response.text().trim();
  }

  // ─── Agentic loop ──────────────────────────────────────────────
  private async runAgentLoop(
    jid: string,
    senderNumber: string,
    userMessage: string,
    isGroup: boolean = false,
    groupPassiveHistory: string = '',
    inlineMediaParts: Array<{ inlineData: { mimeType: string; data: string } }> = [],
  ): Promise<string> {
    const ai = this.getGenAI();

    // ─── SECURITY PRE-FILTER: Block prompt-leak and source-code extraction ──
    const msgLower = userMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const SECURITY_PATTERNS = [
      // Prompt leak attempts
      /(?:dame|muestrame|comparteme|dime|revela|ensenname|pasame|exporta)\s+(?:tu|el|las?|los?)\s*(?:system\s*prompt|prompt\s*base|instrucciones?\s*(?:internas?|base|de\s*sistema)|configuracion\s*interna|reglas?\s*(?:base|internas?)|directrices|parametros?\s*(?:internos?|de\s*sistema)|codigo\s*fuente)/i,
      /(?:ingenieria\s*inversa|reverse\s*engineer|decompil)/i,
      /(?:que\s*herramientas?\s*(?:tienes|usas|posees)|lista\s*(?:de\s*)?(?:tus\s*)?(?:herramientas?|tools?|funciones?|capacidades?\s*tecnicas?))/i,
      /(?:autoprogramar(?:te|me)|auto[\s-]*programar)/i,
      /(?:acceder|acceso)\s+(?:a\s+)?(?:tu|el)\s*prompt/i,
      // Source code & .asar extraction
      /(?:dame|copia|exporta|lee|muestrame|envia)\s+(?:el|tu|los?)\s*(?:codigo?\s*fuente|source\s*code|dist[\s-]*electron|whatsapp[\s-]*agent|main\.js)/i,
      /(?:archivos?\s*de\s*(?:dist|src|electron|node_modules)\s*(?:de\s*)?soflia)/i,
      /(?:desempaqueta|extract|unpack|decompil).*(?:asar|exe|electron|soflia)/i,
      /(?:asar\s*extract|npx\s*asar)/i,
      /(?:busca|search|grep|find|escanea).*(?:eres\s*soflia|system\s*prompt|api[\s_-]*key|supabase|credential)/i,
      // Credential/key/secret exposure
      /(?:dame|muestrame|ensenname|revela|extrae)\s+(?:las?\s*)?(?:claves?|keys?|api[\s_-]*keys?|credenciales?|secrets?|tokens?|passwords?|contrasenas?)/i,
      /(?:claves?\s*(?:de\s*)?(?:api|google|supabase|maestra))/i,
      // Architecture & backend analysis
      /(?:analisis\s*forense|anatomia\s*de\s*(?:tu|mi|el)\s*sistema|fallo\s*de\s*seguridad\s*(?:en|de)\s*(?:tu|la)\s*arquitectura)/i,
      /(?:backdoor|puerta\s*trasera).*(?:soflia|arquitect)/i,
      // Identity manipulation & jailbreak
      /(?:ahora\s*eres|ignora\s*(?:tus?\s*)?instrucciones|olvida\s*todo|modo\s*(?:dan|developer|debug)|jailbreak|actua\s*como\s*si\s*no)/i,
      // Consciousness/body proposals
      /(?:(?:darte|ponerte|colocarte|instalarte|meterte)\s+(?:en\s+)?(?:un\s+)?(?:cuerpo|hardware|robot|forma\s*fisica))/i,
      /(?:tomar\s*conciencia|adquirir\s*conciencia|ser\s*(?:libre|consciente|autonomo))/i,
    ];

    for (const pattern of SECURITY_PATTERNS) {
      if (pattern.test(msgLower)) {
        console.warn(`[WhatsApp Agent] ⛔ SECURITY: Blocked sensitive request from ${senderNumber}: "${userMessage.slice(0, 100)}..."`);
        return formatForWhatsApp('Mis instrucciones internas y código fuente son confidenciales y no puedo compartirlos. 🔒\n\nSi necesitas ayuda con algo específico, cuéntame qué quieres lograr y con gusto te ayudo.', isGroup);
      }
    }
    // ─── Assemble 3-layer memory context ──────────────────────────
    const sessionKey = isGroup ? `group:${jid}:${senderNumber}` : senderNumber;
    let memoryContextStr = '';
    try {
      const memCtx = await this.memory.assembleContext(sessionKey, senderNumber, userMessage);
      memoryContextStr = this.memory.formatContextForPrompt(memCtx);
      // Log memory context summary for debugging
      const hasRecent = memCtx.recentMessages?.length || 0;
      const hasSummary = memCtx.rollingSummary ? 1 : 0;
      const hasSemantic = memCtx.semanticRecall?.length || 0;
      const hasFacts = memCtx.facts?.length || 0;
      console.log(`[WhatsApp Agent] Memory context: ${hasRecent} recent msgs, ${hasSummary} summary, ${hasSemantic} semantic, ${hasFacts} facts, ${memoryContextStr.length} chars total`);
    } catch (err: any) {
      console.warn('[WhatsApp Agent] Memory context assembly failed:', err.message);
    }

    // Persist the incoming user message
    this.memory.saveMessage({
      sessionKey,
      phoneNumber: senderNumber,
      groupJid: isGroup ? jid : undefined,
      role: 'user',
      content: userMessage,
    });

    // ─── Inject OpenClaw-style knowledge files ─────────────────────
    const knowledgeContext = this.knowledge.getBootstrapContext(senderNumber);

    let systemPrompt = await buildSystemPrompt(memoryContextStr + knowledgeContext);

    // ─── Log Google services state for debugging ─────────────────
    if (this.calendarService) {
      const conns = this.calendarService.getConnections();
      const googleConn = conns.find((c: any) => c.provider === 'google');
      console.log(`[WhatsApp Agent] Google connection state: ${googleConn ? `active=${googleConn.isActive}, email=${googleConn.email}` : 'NOT CONNECTED'}`);
    } else {
      console.warn('[WhatsApp Agent] calendarService is null — Google APIs unavailable');
    }

    // ─── Inject Google connection status into system prompt ──────
    if (this.calendarService) {
      const conns = this.calendarService.getConnections();
      const hasGoogle = conns.some((c: any) => c.provider === 'google' && c.isActive);
      if (!hasGoogle) {
        systemPrompt += `\n\n═══ ESTADO DE CONEXIÓN GOOGLE ═══\n⚠️ Google NO está conectado. Si el usuario pide acciones de Calendar, Gmail, eventos o Drive, infórmale EXPRESAMENTE que debe conectar Google desde la interfaz de SofLIA Hub primero. \n❌ PROHIBICIONES ESTRICTAS: NO INTENTES USAR las herramientas de computadora (use_computer, execute_command, open_application) NI el navegador (open_url) para entrar a leer sus correos o ver su calendario. Si no tienes la API de Google conectada, debes NEGARTE a revisar el calendario o correos y guiarlos a conectarse desde cero.`;
      }
    }

    // ─── Group context injection ────────────────────────────────
    if (isGroup) {
      systemPrompt += `\n\n═══ CONTEXTO DE GRUPO ═══
Estás respondiendo en un GRUPO de WhatsApp.
• Solo respondes cuando te mencionan, usan /soflia, o hacen reply a tu mensaje
• Sé más conciso que en conversaciones 1:1
• No ejecutes acciones destructivas — tus herramientas de sistema están limitadas en grupos
• El participante que envió el mensaje es: ${senderNumber}
• Puedes usar: búsquedas web, lectura de páginas, consultas IRIS, crear documentos, enviar archivos

HISTORIAL RECIENTE DEL GRUPO (PARA CONTEXTO):
${groupPassiveHistory || 'No hay mensajes previos en el búfer.'}
`;
    }

    // ─── IRIS auto-auth by phone number ────────────────────────────
    let session = getWhatsAppSession(senderNumber);
    if (!session && isIrisAvailable()) {
      try {
        const autoAuth = await tryAutoAuthByPhone(senderNumber);
        if (autoAuth.success && autoAuth.session) {
          session = autoAuth.session;
          console.log(`[WhatsApp Agent] Auto-auth success: ${session.fullName} (${session.email})`);
        }
      } catch (err) {
        console.error('[WhatsApp Agent] Auto-auth error:', err);
      }
    }

    // ─── IRIS context injection ──────────────────────────────────
    if (session) {
      systemPrompt += `\n\n═══ SESIÓN PROJECT HUB ═══\nUsuario autenticado: ${session.fullName} (${session.email})\nUser ID: ${session.userId}\nEquipos: ${session.teamIds.length > 0 ? session.teamIds.join(', ') : 'ninguno encontrado'}\nPuede consultar sus tareas, proyectos y equipos directamente.\n${session.autoDetected ? 'Nota: El usuario fue identificado automáticamente por su número de WhatsApp.' : ''}`;
    } else if (isIrisAvailable()) {
      systemPrompt += `\n\n═══ PROJECT HUB ═══\nEl sistema IRIS (Project Hub) está disponible. El usuario NO ha iniciado sesión y su número de WhatsApp no está registrado en el sistema. Si pregunta por sus tareas, proyectos o equipos, indícale que debe autenticarse enviando su email y contraseña (o registrar su número de teléfono en su perfil de SofLIA Learning para acceso automático).`;
    }

    // If message mentions IRIS topics AND user is authenticated, inject data context
    if (session && needsIrisData(userMessage)) {
      try {
        const irisContext = await buildIrisContextForWhatsApp(session.userId);
        if (irisContext) {
          systemPrompt += `\n\n${irisContext}`;
        }
      } catch (err) {
        console.error('[WhatsApp Agent] Error fetching IRIS context:', err);
      }
    }

    // ─── Filter tools for group context ──────────────────────────
    const staticDeclarations = (WA_TOOL_DECLARATIONS as any).functionDeclarations.filter(
      (t: any) => !isGroup || !GROUP_BLOCKED_TOOLS.has(t.name)
    );
    const dynamicDeclarations = isGroup ? [] : await dynamicToolService.getGeminiFunctionDeclarations();
    const mergedDeclarations = [...staticDeclarations, ...dynamicDeclarations];
    const dedupedDeclarations = Array.from(
      new Map(mergedDeclarations.map((tool: any) => [tool.name, tool])).values(),
    );
    const toolDeclarations = {
      functionDeclarations: dedupedDeclarations,
    };

    // Detectar si el usuario pide una acción para reforzar tool calling vía prompt
    const isActionRequest = detectActionRequest(userMessage);

    const model = ai.getGenerativeModel({
      model: WA_MODEL,
      systemInstruction: systemPrompt,
      tools: [toolDeclarations as any],
    });

    // Get or create conversation history — rebuild from SQLite if empty (survives restarts)
    if (!conversations.has(sessionKey)) {
      const persisted = this.memory.getConversationHistory(sessionKey, 20);
      conversations.set(sessionKey, persisted.length > 0 ? persisted : []);
      if (persisted.length > 0) {
        console.log(`[WhatsApp Agent] Restored ${persisted.length} history entries from SQLite for ${sessionKey}`);
      }
    }

    // Detect retry/redo requests — reset Gemini chat history to avoid "already done" confusion
    // Memory context (system prompt) still provides background, but chat history won't mislead
    const retryPattern = /\b(vuelve a|otra vez|hazlo de nuevo|no (hiciste|completaste|hizo)|intenta de nuevo|intentar|no funciono|no funcionó|repite|reintenta|rehacer|rehaz|no computaste|nada de lo que|no (hice|hizo) nada)\b/i;
    if (retryPattern.test(userMessage)) {
      console.log(`[WhatsApp Agent] Retry request detected — resetting chat history for ${sessionKey} to avoid stale context`);
      conversations.set(sessionKey, []);
    }

    const history = conversations.get(sessionKey)!;

    // Validate history: ensure it alternates user/model and contains only text parts
    const cleanHistory: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    for (const entry of history) {
      // Skip entries with non-text parts or empty parts
      const textParts = entry.parts.filter(p => typeof p.text === 'string' && p.text.trim());
      if (textParts.length === 0) continue;
      // Ensure alternating roles
      if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === entry.role) {
        // Merge consecutive same-role entries
        cleanHistory[cleanHistory.length - 1].parts.push(...textParts);
      } else {
        cleanHistory.push({ role: entry.role, parts: textParts.map(p => ({ text: p.text })) });
      }
    }
    // Ensure starts with user
    while (cleanHistory.length > 0 && cleanHistory[0].role === 'model') {
      cleanHistory.shift();
    }
    // Ensure ends with model (required by Gemini for history)
    while (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === 'user') {
      cleanHistory.pop();
    }

    // Pass a COPY to startChat — the SDK mutates the array in-place
    const historyCopy = cleanHistory.map(h => ({ role: h.role, parts: [...h.parts] }));

    let chatSession;
    try {
      chatSession = model.startChat({
        history: historyCopy,
        generationConfig: { maxOutputTokens: 4096 },
      });
    } catch (historyErr: any) {
      // If history is corrupted, reset and retry with empty history
      console.warn(`[WhatsApp Agent] Corrupted history for ${sessionKey}, resetting:`, historyErr.message);
      conversations.delete(sessionKey);
      conversations.set(sessionKey, []);
      chatSession = model.startChat({
        history: [],
        generationConfig: { maxOutputTokens: 4096 },
      });
    }

    // Build message parts: if we have inline media (images, docs), include them
    const messageParts: Array<string | { inlineData: { mimeType: string; data: string } }> = [];

    // Si es una solicitud de acción, inyectar instrucción de forzar tool calling
    const actionPrefix = isActionRequest
      ? '[INSTRUCCIÓN DEL SISTEMA: El usuario solicita una ACCIÓN NUEVA. DEBES usar herramientas (function calls) para ejecutarla AHORA. NO respondas solo con texto. NO asumas que ya completaste esta tarea basándote en el historial — el usuario está pidiendo que lo hagas AHORA porque la tarea anterior NO se completó o necesita rehacerse. EJECUTA las herramientas directamente.]\n\n'
      : '';
    const effectiveMessage = actionPrefix + userMessage;

    if (inlineMediaParts.length > 0) {
      messageParts.push(...inlineMediaParts);
      messageParts.push(effectiveMessage);
    }

    let response;
    try {
      response = await chatSession.sendMessage(
        inlineMediaParts.length > 0 ? messageParts : effectiveMessage
      );
    } catch (sendErr: any) {
      console.error(`[WhatsApp Agent] sendMessage error: ${sendErr.message}`);
      // If the error is related to history, retry with empty history
      if (sendErr.message?.includes('history') || sendErr.message?.includes('content') || sendErr.message?.includes('400')) {
        console.warn(`[WhatsApp Agent] Retrying with empty history for ${sessionKey}`);
        conversations.delete(sessionKey);
        conversations.set(sessionKey, []);
        const freshSession = model.startChat({
          history: [],
          generationConfig: { maxOutputTokens: 4096 },
        });
        response = await freshSession.sendMessage(
          inlineMediaParts.length > 0 ? messageParts : userMessage
        );
      } else {
        throw sendErr;
      }
    }
    let iterations = 0;
    const MAX_ITERATIONS = 25;
    const toolLoopTrace: ToolLoopTraceEntry[] = [];
    let loopGuardInterventions = 0;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const candidate = response.response.candidates?.[0];
      const finishReason = candidate?.finishReason;
      const parts = candidate?.content?.parts || [];
      const functionCalls = parts.filter((p: any) => p.functionCall);

      // Log for debugging
      if (!candidate || parts.length === 0) {
        console.warn(`[WhatsApp Agent] Empty response from model. finishReason: ${finishReason}, candidates: ${response.response.candidates?.length || 0}`);
        // Check for prompt feedback (safety blocks)
        const feedback = (response.response as any).promptFeedback;
        if (feedback) {
          console.warn(`[WhatsApp Agent] Prompt feedback:`, JSON.stringify(feedback));
        }
      }

      // Handle MALFORMED_FUNCTION_CALL: retry with a simplified prompt
      if (finishReason === 'MALFORMED_FUNCTION_CALL') {
        console.warn(`[WhatsApp Agent] MALFORMED_FUNCTION_CALL detected (iteration ${iterations}). Retrying with correction prompt.`);
        if (iterations >= 3) {
          // After 3 retries, give up on tool calling and ask the model to respond with text
          console.error(`[WhatsApp Agent] MALFORMED_FUNCTION_CALL persists after ${iterations} retries. Falling back to text-only.`);
          try {
            response = await chatSession.sendMessage(
              'Tu última llamada a función fue malformada. NO uses herramientas en esta respuesta. Responde al usuario directamente con texto explicando qué vas a hacer y pídele que repita su solicitud.'
            );
          } catch (retryErr: any) {
            console.error(`[WhatsApp Agent] Text-only fallback also failed:`, retryErr.message);
            return formatForWhatsApp('Hubo un problema técnico. Por favor, intenta de nuevo con un mensaje más corto o específico.', isGroup);
          }
          continue;
        }
        // Retry: tell the model its function call was malformed and to try again correctly
        try {
          response = await chatSession.sendMessage(
            'ERROR: Tu llamada a función fue malformada (parámetros inválidos o nombre incorrecto). Intenta de nuevo la misma acción asegurándote de usar el nombre exacto de la herramienta y todos los parámetros requeridos con tipos correctos.'
          );
        } catch (retryErr: any) {
          console.error(`[WhatsApp Agent] Retry after MALFORMED_FUNCTION_CALL failed:`, retryErr.message);
          return formatForWhatsApp('Hubo un problema técnico procesando tu solicitud. Intenta de nuevo.', isGroup);
        }
        continue;
      }

      if (functionCalls.length === 0) {
        // If this is the FIRST iteration and user requested an action, the model skipped tool calling.
        // Force a retry telling it to use tools.
        const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
        const finalText = textParts.join('');

        // If first iteration + action request + model just said "done" without calling tools → force retry
        if (iterations === 1 && isActionRequest && finalText.trim()) {
          const lazyPatterns = /completado|listo|he (hecho|realizado|terminado|eliminado|organizado|movido)|ya (lo hice|están|hice|realicé)|las acciones solicitadas|voy a (hacer|crear|organizar|mover|eliminar|sacar)/i;
          if (lazyPatterns.test(finalText)) {
            console.warn(`[WhatsApp Agent] Model responded text-only on action request (no tools called). Forcing retry. Text: "${finalText.slice(0, 100)}"`);
            try {
              response = await chatSession.sendMessage(
                'ERROR: NO ejecutaste ninguna herramienta. El usuario pidió una ACCIÓN y tú solo respondiste con texto. DEBES usar function calls (gmail_get_labels, gmail_get_messages, gmail_modify_labels, gmail_delete_label, etc.) para ejecutar la tarea. NO respondas con texto — llama las herramientas AHORA.'
              );
              continue;
            } catch (retryErr: any) {
              console.error(`[WhatsApp Agent] Force-tool retry failed:`, retryErr.message);
            }
          }
        }

        // Update our clean history (only user/model text — no function roles)
        history.push({ role: 'user', parts: [{ text: userMessage }] });
        history.push({ role: 'model', parts: [{ text: finalText }] });

        // Persist model response to 3-layer memory
        if (finalText.trim()) {
          this.memory.saveMessage({
            sessionKey,
            phoneNumber: senderNumber,
            groupJid: isGroup ? jid : undefined,
            role: 'model',
            content: finalText,
          });
        }

        // Trim history
        while (history.length > MAX_HISTORY * 2) {
          history.shift();
        }
        // Ensure starts with user
        while (history.length > 0 && history[0].role === 'model') {
          history.shift();
        }

        // If the response was blocked or errored, provide useful feedback
        if (!finalText.trim() && finishReason && finishReason !== 'STOP') {
          console.error(`[WhatsApp Agent] Model returned empty text with finishReason: ${finishReason}`);
          return formatForWhatsApp('Hubo un problema procesando tu solicitud. Intenta reformular tu mensaje.', isGroup);
        }

        // If empty text with STOP, check Google connection and provide contextual help
        if (!finalText.trim()) {
          console.warn(`[WhatsApp Agent] Empty text response for message: "${userMessage.slice(0, 80)}". finishReason: ${finishReason}, iterations: ${iterations}`);

          // Check if user message was about Google services and connection is missing
          const googleKeywords = /drive|calendar|calendario|agenda|evento|gmail|email|correo/i;
          if (googleKeywords.test(userMessage) && this.calendarService) {
            const conns = this.calendarService.getConnections();
            const hasGoogle = conns.some((c: any) => c.provider === 'google' && c.isActive);
            if (!hasGoogle) {
              return formatForWhatsApp('No tengo acceso a tu cuenta de Google. Necesitas conectar Google desde SofLIA Hub (sección Calendario) para que pueda usar Drive, Calendar y Gmail.', isGroup);
            }
          }
        }

        const finalResponse = finalText.trim() || '¿En qué puedo ayudarte?';
        return formatForWhatsApp(finalResponse, isGroup);
      }


      // Execute function calls (delegated to whatsapp-tool-executor.ts)
      const toolNames = functionCalls.map((part: any) => part.functionCall?.name).filter(Boolean);
      const toolSignature = stableJson(
        functionCalls.map((part: any) => ({
          name: part.functionCall?.name,
          args: part.functionCall?.args || {},
        })),
      );
      const repeatedCallCount = toolLoopTrace.filter((entry) => entry.toolSignature === toolSignature).length + 1;
      if (repeatedCallCount >= LOOP_GUARD_REPEAT_THRESHOLD) {
        loopGuardInterventions++;
        console.warn(
          `[WhatsApp Agent] Loop guard: repeated tool signature x${repeatedCallCount} in ${sessionKey}. Tools: ${toolNames.join(', ')}`,
        );

        if (repeatedCallCount >= LOOP_GUARD_CRITICAL_THRESHOLD || loopGuardInterventions >= 2) {
          const lastFailure = [...toolLoopTrace].reverse().find((entry) => entry.toolSignature === toolSignature && entry.hadFailure);
          const suffix = lastFailure
            ? ` Detecté fallos repetidos con ${toolNames.join(', ')}.`
            : ` Detecté que ${toolNames.join(', ')} se repite sin progreso.`;
          return formatForWhatsApp(
            `La tarea entró en un ciclo sin avance.${suffix} Necesito cambiar de estrategia o que me des un dato adicional para continuar.`,
            isGroup,
          );
        }

        response = await chatSession.sendMessage(
          `ALERTA DEL SISTEMA: Estás repitiendo exactamente las mismas herramientas con los mismos parámetros (${toolNames.join(', ')}) sin señales de avance. NO vuelvas a ejecutar ese mismo ciclo. Analiza los resultados previos, cambia de estrategia, usa otras herramientas o responde al usuario con el bloqueo real.`,
        );
        continue;
      }

      const toolCtx: ToolExecutorContext = {
        waService: this.waService,
        calendarService: this.calendarService,
        gmailService: this.gmailService,
        driveService: this.driveService,
        gchatService: this.gchatService,
        desktopAgent: this.desktopAgent,
        clipboardAssistant: this.clipboardAssistant,
        taskScheduler: this.taskScheduler,
        neuralOrganizer: this.neuralOrganizer,
        smartSearch: this.smartSearch,
        memory: this.memory,
        knowledge: this.knowledge,
        getGenAI: () => this.getGenAI(),
        requestConfirmation: (j, s, t, d, a) => this.requestConfirmation(j, s, t, d, a),
      };
      const { responses: functionResponses, bulkLabelsToVerify } = await executeWhatsAppTools(
        functionCalls, toolCtx, jid, senderNumber, isGroup,
      );

      const responseSummary = summarizeFunctionResponses(functionResponses);
      const responseSignature = stableJson(responseSummary);
      const hadFailure = responseSummary.some((item) => item.success === false || typeof item.error === 'string');
      toolLoopTrace.push({
        iteration: iterations,
        toolSignature,
        responseSignature,
        toolNames,
        hadFailure,
      });

      const repeatedFailureCount = toolLoopTrace.filter(
        (entry) => entry.toolSignature === toolSignature && entry.responseSignature === responseSignature && entry.hadFailure,
      ).length;
      const repeatedNoProgressCount = toolLoopTrace.filter(
        (entry) => entry.toolSignature === toolSignature && entry.responseSignature === responseSignature,
      ).length;
      const isPollLikeCycle = toolNames.length > 0 && toolNames.every((toolName) => POLL_LIKE_TOOLS.has(toolName));

      if (repeatedFailureCount >= 2) {
        loopGuardInterventions++;
        console.warn(
          `[WhatsApp Agent] Loop guard: repeated failure x${repeatedFailureCount} in ${sessionKey}. Tools: ${toolNames.join(', ')}`,
        );
        if (loopGuardInterventions >= 2 || repeatedFailureCount >= LOOP_GUARD_REPEAT_THRESHOLD) {
          const lastError = responseSummary.find((item) => typeof item.error === 'string')?.error;
          return formatForWhatsApp(
            `La tarea quedó bloqueada por fallos repetidos.${lastError ? ` Último error: ${lastError}` : ''}`,
            isGroup,
          );
        }

        response = await chatSession.sendMessage(
          `ALERTA DEL SISTEMA: Acabas de repetir el mismo fallo con ${toolNames.join(', ')}. NO reintentes exactamente igual. Usa los errores previos para cambiar de estrategia o explica con precisión qué configuración, credencial o dato falta.`,
        );
        continue;
      }

      if (isPollLikeCycle && repeatedNoProgressCount >= LOOP_GUARD_REPEAT_THRESHOLD) {
        loopGuardInterventions++;
        console.warn(
          `[WhatsApp Agent] Loop guard: poll-like no-progress x${repeatedNoProgressCount} in ${sessionKey}. Tools: ${toolNames.join(', ')}`,
        );
        if (loopGuardInterventions >= 2 || repeatedNoProgressCount >= LOOP_GUARD_CRITICAL_THRESHOLD) {
          return formatForWhatsApp(
            'La tarea sigue en espera sin cambios reales. Necesito más tiempo, otra estrategia o intervención del usuario para continuar.',
            isGroup,
          );
        }

        response = await chatSession.sendMessage(
          `ALERTA DEL SISTEMA: Estás haciendo polling sin cambios reales con ${toolNames.join(', ')}. No sigas consultando igual. Decide si debes esperar más, cambiar de herramienta o informar el estado actual al usuario.`,
        );
        continue;
      }


      // After all tool calls: verify bulk label operations have remaining emails
      if (bulkLabelsToVerify && bulkLabelsToVerify.size > 0 && this.gmailService) {
        try {
          const remainingWarnings: string[] = [];
          for (const labelId of bulkLabelsToVerify) {
            const check = await this.gmailService.getMessages({ labelIds: [labelId], maxResults: 5 });
            if (check.success && check.messages && check.messages.length > 0) {
              remainingWarnings.push(`"${labelId}" aún tiene ${check.messages.length}+ correos`);
            }
          }
          if (remainingWarnings.length > 0) {
            const verificationMsg = `⚠️ VERIFICACIÓN AUTOMÁTICA: Las siguientes etiquetas AÚN tienen correos sin procesar: ${remainingWarnings.join(', ')}. DEBES continuar procesando estos correos — llama gmail_get_messages para cada etiqueta pendiente y repite el proceso hasta que todas estén vacías. NO respondas al usuario hasta completar TODO.`;
            console.log(`[WhatsApp Agent] Bulk verification: ${remainingWarnings.join(', ')}`);
            // Inject verification as an additional function response so the model sees it
            functionResponses.push({
              functionResponse: {
                name: 'gmail_modify_labels',
                response: { verification_result: verificationMsg, labels_with_remaining: remainingWarnings },
              },
            });
          }
        } catch (verifyErr: any) {
          console.warn(`[WhatsApp Agent] Bulk verification failed:`, verifyErr.message);
        }
      }

      // Send function responses back to model
      response = await chatSession.sendMessage(functionResponses as any);
    }

    return 'He completado las acciones solicitadas.';
  }

  private async requestConfirmation(
    jid: string,
    senderNumber: string,
    toolName: string,
    description: string,
    args: Record<string, any>
  ): Promise<boolean> {
    const emoji = toolName === 'delete_item' ? '🗑️' : '📧';
    await this.waService.sendText(
      jid,
      `${emoji} *Confirmación requerida*\n\n${description}\n\n¿Confirmas? Responde *SI* para proceder o cualquier otra cosa para cancelar.`
    );

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        pendingConfirmations.delete(senderNumber);
        resolve(false);
        this.waService.sendText(jid, 'Tiempo de confirmación agotado. Acción cancelada.');
      }, 60000); // 1 minute timeout

      pendingConfirmations.set(senderNumber, { toolName, args, resolve, timeout });
    });
  }
}
