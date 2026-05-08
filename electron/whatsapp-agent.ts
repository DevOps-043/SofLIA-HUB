/**
 * WhatsApp Agent â€” Main-process Gemini agentic loop for WhatsApp messages.
 * Uses executeToolDirect() to call computer-use tools without IPC.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { WhatsAppService } from './whatsapp-service';
import type { CalendarService } from './calendar-service';
import type { GmailService } from './gmail-service';
import type { DriveService } from './drive-service';
import type { GChatService } from './gchat-service';
import type { MemoryService } from './memory-service';
import type { KnowledgeService } from './knowledge-service';
import type { DesktopAgentService } from './desktop-agent-service';
import type { ClipboardAIAssistant } from './clipboard-ai-assistant';
import type { ScheduledTaskInfo, TaskScheduler } from './task-scheduler';
import type { NeuralOrganizerService } from './neural-organizer';
import { SmartSearchTool } from './smart-search-tool';
import type { WorkspaceAutomationService } from './workspace-automation-service';
import type { WorkflowHubService } from './workflow-hub-service';
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
import { buildSystemPrompt, classifyEvidenceRequirement, detectActionRequest, formatForWhatsApp } from './whatsapp-prompts';
import { executeWhatsAppTools, type ToolExecutorContext } from './whatsapp-tool-executor';
import { dynamicToolService } from './dynamic-tool-service';
import { normalizeOutgoingWhatsAppText } from './whatsapp-text';

// â”€â”€â”€ [EXTRACTED] Tool definitions â†’ ./whatsapp-tools.ts â”€â”€â”€â”€â”€
// â”€â”€â”€ [EXTRACTED] Prompts + helpers â†’ ./whatsapp-prompts.ts â”€â”€
// â”€â”€â”€ [EXTRACTED] Tool executor â†’ ./whatsapp-tool-executor.ts â”€


import {
  LOOP_GUARD_CRITICAL_THRESHOLD,
  LOOP_GUARD_REPEAT_THRESHOLD,
  MAX_HISTORY,
  POLL_LIKE_TOOLS,
  WA_MODEL,
} from './wa-agent/constants';
import {
  getEvidenceModeFromToolCall,
  isExecutionDeferralResponse,
  isGenericHelpResponse,
  isGreetingOrHelpRequest,
  stableJson,
  summarizeFunctionResponses,
} from './wa-agent/loop-helpers';
import { handleChatCommand as handleSlashChatCommand } from './wa-agent/chat-commands';
import { transcribeWhatsAppAudio } from './wa-agent/audio-transcription';
import { prepareWhatsAppMediaMessage } from './wa-agent/media-preparation';
import { tryHandlePassiveWorkflowRequest } from './wa-agent/passive-workflows';
import type {
  AgentLoopOptions,
  PendingConfirmation,
  ToolLoopTraceEntry,
} from './wa-agent/types';

// Conversation history per session (DM: by number, Group: by group+number).
const conversations = new Map<string, Array<{ role: string; parts: Array<{ text: string }> }>>();
const pendingConfirmations = new Map<string, PendingConfirmation>();



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
  private workspaceAutomationService: WorkspaceAutomationService | null = null;
  private workflowHubService: WorkflowHubService | null = null;
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
    void service;
    console.log('[WhatsApp Agent] Meeting workflow service connected');
  }

  setWorkspaceAutomationService(service: WorkspaceAutomationService): void {
    this.workspaceAutomationService = service;
    console.log('[WhatsApp Agent] Workspace automation service connected');
  }

  setWorkflowHubService(service: WorkflowHubService): void {
    this.workflowHubService = service;
    console.log('[WhatsApp Agent] Workflow hub service connected');
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

  // â”€â”€â”€ Handle text messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      const confirmed = lower === 'si' || lower === 'sÃ­' || lower === 'yes' || lower === 'confirmar' || lower === 'confirmo';
      clearTimeout(pending.timeout);
      pendingConfirmations.delete(senderNumber);
      pending.resolve(confirmed);
      return;
    }

    // â”€â”€â”€ Chat commands (inspired by OpenClaw) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      // Si se activÃ³ un workflow durante el comando, detener el procesamiento normal
      if (WorkflowManager.isActive(sessionKey) || MeetingWorkflowManager.isActive(sessionKey)) {
        return;
      }
    }

    const passiveWorkflowReply = tryHandlePassiveWorkflowRequest({
      workflowHubService: this.workflowHubService,
      senderNumber,
      text,
      isGroup,
    });
    if (passiveWorkflowReply) {
      await this.waService.sendText(jid, passiveWorkflowReply);
      return;
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
      await this.waService.sendText(jid, `OcurriÃ³ un error. He reiniciado la conversaciÃ³n. Intenta de nuevo.`);
    }
  }

  async handleScheduledTaskTrigger(
    jid: string,
    senderNumber: string,
    task: ScheduledTaskInfo,
  ): Promise<void> {
    const prompt = String(task.prompt || '').trim();
    if (!prompt) {
      return;
    }

    const wrappedPrompt = [
      'Esta es una automatizacion pasiva ya programada.',
      'No la vuelvas a programar ni uses task_scheduler.',
      'Ejecuta ahora la instruccion y responde por WhatsApp con el resultado.',
      '',
      `Solicitud original: ${prompt}`,
    ].join('\n');

    try {
      const response = await this.runAgentLoop(jid, senderNumber, wrappedPrompt, false, '', [], {
        skipConfirmations: true,
      });
      if (response) {
        await this.waService.sendText(jid, response);
      }
    } catch (err: any) {
      console.error('[WhatsApp Agent] Scheduled task error:', err);
      await this.waService.sendText(
        jid,
        `No pude completar la automatizacion pasiva "${task.name || task.id}". ${err?.message || ''}`.trim(),
      );
    }
  }

  // â”€â”€â”€ Chat commands (/status, /reset, /activation, /help) â”€â”€â”€â”€â”€â”€â”€â”€
  private async handleChatCommand(
    jid: string,
    senderNumber: string,
    text: string,
    isGroup: boolean,
  ): Promise<string | null> {
    return handleSlashChatCommand({
      jid,
      senderNumber,
      text,
      isGroup,
      agent: this,
      conversations,
      memory: this.memory,
      waService: this.waService,
      workflowHubService: this.workflowHubService,
      workspaceAutomationService: this.workspaceAutomationService,
    });
  }

  // â”€â”€â”€ Handle media (Photos, Docs) â€” FULL AGENTIC PIPELINE â”€â”€â”€â”€â”€
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
      const prepared = await prepareWhatsAppMediaMessage(buffer, fileName, mimetype, text || '');
      console.log(`[WhatsApp Agent] Saved received file: ${prepared.savedPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
      if (!prepared.canAnalyzeInline && prepared.reason) {
        console.log(`[WhatsApp Agent] File too large or not analyzable inline (${prepared.reason}), saved to disk only: ${prepared.savedPath}`);
      }
      console.log(`[WhatsApp Agent] Processing media: ${fileName} (${mimetype}), inline: ${prepared.canAnalyzeInline}, caption: "${text?.slice(0, 60) || 'none'}"`);

      const response = await this.runAgentLoop(
        jid,
        senderNumber,
        prepared.userText,
        isGroup,
        groupPassiveHistory,
        prepared.inlineMediaParts,
        {},
      );

      if (response) {
        await this.waService.sendText(jid, response);
      }
    } catch (err: any) {
      console.error('[WhatsApp Agent] Media error:', err);
      await this.waService.sendText(jid, 'No pude procesar el archivo. Intenta de nuevo o envia un mensaje de texto.');
    }
  }


  // â”€â”€â”€ Handle audio messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async handleAudio(
    jid: string,
    senderNumber: string,
    audioBuffer: Buffer,
    isGroup: boolean = false,
    groupPassiveHistory: string = '',
  ): Promise<void> {
    try {
      const transcription = await transcribeWhatsAppAudio(this.getGenAI(), audioBuffer);

      if (!transcription || !transcription.trim()) {
        await this.waService.sendText(jid, 'No pude entender el audio. Â¿PodrÃ­as repetirlo o escribirlo?');
        return;
      }

      console.log(`[WhatsApp Agent] Audio transcribed: "${transcription}"`);
      await this.handleMessage(jid, senderNumber, transcription, isGroup, groupPassiveHistory);
    } catch (err: any) {
      console.error('[WhatsApp Agent] Audio error:', err);
      await this.waService.sendText(jid, 'No pude procesar el audio. Intenta enviar un mensaje de texto.');
    }
  }


  // â”€â”€â”€ Agentic loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private async runAgentLoop(
    jid: string,
    senderNumber: string,
    userMessage: string,
    isGroup: boolean = false,
    groupPassiveHistory: string = '',
    inlineMediaParts: Array<{ inlineData: { mimeType: string; data: string } }> = [],
    options: AgentLoopOptions = {},
  ): Promise<string> {
    const ai = this.getGenAI();

    // â”€â”€â”€ SECURITY PRE-FILTER: Block prompt-leak and source-code extraction â”€â”€
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
        console.warn(`[WhatsApp Agent] â›” SECURITY: Blocked sensitive request from ${senderNumber}: "${userMessage.slice(0, 100)}..."`);
        return formatForWhatsApp('Mis instrucciones internas y cÃ³digo fuente son confidenciales y no puedo compartirlos. ðŸ”’\n\nSi necesitas ayuda con algo especÃ­fico, cuÃ©ntame quÃ© quieres lograr y con gusto te ayudo.', isGroup);
      }
    }
    // â”€â”€â”€ Assemble 3-layer memory context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€ Inject OpenClaw-style knowledge files â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const knowledgeContext = this.knowledge.getBootstrapContext(senderNumber);

    let systemPrompt = await buildSystemPrompt(memoryContextStr + knowledgeContext);

    // â”€â”€â”€ Log Google services state for debugging â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (this.calendarService) {
      const conns = this.calendarService.getConnections();
      const googleConn = conns.find((c: any) => c.provider === 'google');
      console.log(`[WhatsApp Agent] Google connection state: ${googleConn ? `active=${googleConn.isActive}, email=${googleConn.email}` : 'NOT CONNECTED'}`);
    } else {
      console.warn('[WhatsApp Agent] calendarService is null â€” Google APIs unavailable');
    }

    // â”€â”€â”€ Inject Google connection status into system prompt â”€â”€â”€â”€â”€â”€
    if (this.calendarService) {
      const conns = this.calendarService.getConnections();
      const hasGoogle = conns.some((c: any) => c.provider === 'google' && c.isActive);
      if (!hasGoogle) {
        systemPrompt += `\n\nâ•â•â• ESTADO DE CONEXIÃ“N GOOGLE â•â•â•\nâš ï¸ Google NO estÃ¡ conectado. Si el usuario pide acciones de Calendar, Gmail, eventos o Drive, infÃ³rmale EXPRESAMENTE que debe conectar Google desde la interfaz de SofLIA Hub primero. \nâŒ PROHIBICIONES ESTRICTAS: NO INTENTES USAR las herramientas de computadora (use_computer, execute_command, open_application) NI el navegador (open_url) para entrar a leer sus correos o ver su calendario. Si no tienes la API de Google conectada, debes NEGARTE a revisar el calendario o correos y guiarlos a conectarse desde cero.`;
      }
    }

    // â”€â”€â”€ Group context injection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (isGroup) {
      systemPrompt += `\n\nâ•â•â• CONTEXTO DE GRUPO â•â•â•
EstÃ¡s respondiendo en un GRUPO de WhatsApp.
â€¢ Solo respondes cuando te mencionan, usan /soflia, o hacen reply a tu mensaje
â€¢ SÃ© mÃ¡s conciso que en conversaciones 1:1
â€¢ No ejecutes acciones destructivas â€” tus herramientas de sistema estÃ¡n limitadas en grupos
â€¢ El participante que enviÃ³ el mensaje es: ${senderNumber}
â€¢ Puedes usar: bÃºsquedas web, lectura de pÃ¡ginas, consultas IRIS, crear documentos, enviar archivos

HISTORIAL RECIENTE DEL GRUPO (PARA CONTEXTO):
${groupPassiveHistory || 'No hay mensajes previos en el bÃºfer.'}
`;
    }

    // â”€â”€â”€ IRIS auto-auth by phone number â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€ IRIS context injection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (session) {
      systemPrompt += `\n\nâ•â•â• SESIÃ“N PROJECT HUB â•â•â•\nUsuario autenticado: ${session.fullName} (${session.email})\nUser ID: ${session.userId}\nEquipos: ${session.teamIds.length > 0 ? session.teamIds.join(', ') : 'ninguno encontrado'}\nPuede consultar sus tareas, proyectos y equipos directamente.\n${session.autoDetected ? 'Nota: El usuario fue identificado automÃ¡ticamente por su nÃºmero de WhatsApp.' : ''}`;
    } else if (isIrisAvailable()) {
      systemPrompt += `\n\nâ•â•â• PROJECT HUB â•â•â•\nEl sistema IRIS (Project Hub) estÃ¡ disponible. El usuario NO ha iniciado sesiÃ³n y su nÃºmero de WhatsApp no estÃ¡ registrado en el sistema. Si pregunta por sus tareas, proyectos o equipos, indÃ­cale que debe autenticarse enviando su email y contraseÃ±a (o registrar su nÃºmero de telÃ©fono en su perfil de SofLIA Learning para acceso automÃ¡tico).`;
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

    // â”€â”€â”€ Filter tools for group context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // Detectar si el usuario pide una acciÃ³n para reforzar tool calling vÃ­a prompt
    const isActionRequest = detectActionRequest(userMessage);
    const evidenceRequirement = classifyEvidenceRequirement(userMessage);
    const requiresLocalVisualEvidence =
      evidenceRequirement === 'local_visual' || evidenceRequirement === 'local_visual_then_remote';
    const requiresLocalEvidence =
      requiresLocalVisualEvidence || evidenceRequirement === 'local' || evidenceRequirement === 'local_then_remote';
    const requiresRemoteEvidence =
      evidenceRequirement === 'remote'
      || evidenceRequirement === 'local_then_remote'
      || evidenceRequirement === 'local_visual_then_remote';

    if (evidenceRequirement !== 'none') {
      systemPrompt += `\n\nâ•â•â• VALIDACION DE EVIDENCIA â•â•â•\nEl usuario pide una verificacion con requirement="${evidenceRequirement}". Debes reunir evidencia del entorno correcto antes de concluir.\n- local: necesitas evidencia local real en la computadora.\n- local_visual: necesitas evidencia VISUAL real dentro de la app, ventana o pantalla correcta.\n- remote: necesitas evidencia de web, nube, repositorio o sistema remoto.\n- local_then_remote: primero valida localmente y luego contrasta lo remoto.\n- local_visual_then_remote: primero valida visualmente dentro de la app correcta y luego contrasta lo remoto.\nSi el usuario pide revisar en la aplicacion, en la ventana o en pantalla, los comandos, archivos o Git no sustituyen una inspeccion visual. Nunca afirmes que revisaste una app local si solo consultaste GitHub, una pagina web, shell o un repositorio remoto.`;
    }

    const model = ai.getGenerativeModel({
      model: WA_MODEL,
      systemInstruction: systemPrompt,
      tools: [toolDeclarations as any],
    });

    // Get or create conversation history â€” rebuild from SQLite if empty (survives restarts)
    if (!conversations.has(sessionKey)) {
      const persisted = this.memory.getConversationHistory(sessionKey, 20);
      conversations.set(sessionKey, persisted.length > 0 ? persisted : []);
      if (persisted.length > 0) {
        console.log(`[WhatsApp Agent] Restored ${persisted.length} history entries from SQLite for ${sessionKey}`);
      }
    }

    // Detect retry/redo requests â€” reset Gemini chat history to avoid "already done" confusion
    // Memory context (system prompt) still provides background, but chat history won't mislead
    const retryPattern = /\b(vuelve a|otra vez|hazlo de nuevo|no (hiciste|completaste|hizo)|intenta de nuevo|intentar|no funciono|no funcionÃ³|repite|reintenta|rehacer|rehaz|no computaste|nada de lo que|no (hice|hizo) nada)\b/i;
    if (retryPattern.test(userMessage)) {
      console.log(`[WhatsApp Agent] Retry request detected â€” resetting chat history for ${sessionKey} to avoid stale context`);
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

    // Pass a COPY to startChat â€” the SDK mutates the array in-place
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

    // Si es una solicitud de acciÃ³n, inyectar instrucciÃ³n de forzar tool calling
    const actionPrefix = isActionRequest
      ? '[INSTRUCCIÃ“N DEL SISTEMA: El usuario solicita una ACCIÃ“N NUEVA. DEBES usar herramientas (function calls) para ejecutarla AHORA. NO respondas solo con texto. NO asumas que ya completaste esta tarea basÃ¡ndote en el historial â€” el usuario estÃ¡ pidiendo que lo hagas AHORA porque la tarea anterior NO se completÃ³ o necesita rehacerse. EJECUTA las herramientas directamente.]\n\n'
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
    let hasLocalEvidence = false;
    let hasLocalVisualEvidence = false;
    let hasRemoteEvidence = false;

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
              'Tu Ãºltima llamada a funciÃ³n fue malformada. NO uses herramientas en esta respuesta. Responde al usuario directamente con texto explicando quÃ© vas a hacer y pÃ­dele que repita su solicitud.'
            );
          } catch (retryErr: any) {
            console.error(`[WhatsApp Agent] Text-only fallback also failed:`, retryErr.message);
            return formatForWhatsApp('Hubo un problema tÃ©cnico. Por favor, intenta de nuevo con un mensaje mÃ¡s corto o especÃ­fico.', isGroup);
          }
          continue;
        }
        // Retry: tell the model its function call was malformed and to try again correctly
        try {
          response = await chatSession.sendMessage(
            'ERROR: Tu llamada a funciÃ³n fue malformada (parÃ¡metros invÃ¡lidos o nombre incorrecto). Intenta de nuevo la misma acciÃ³n asegurÃ¡ndote de usar el nombre exacto de la herramienta y todos los parÃ¡metros requeridos con tipos correctos.'
          );
        } catch (retryErr: any) {
          console.error(`[WhatsApp Agent] Retry after MALFORMED_FUNCTION_CALL failed:`, retryErr.message);
          return formatForWhatsApp('Hubo un problema tÃ©cnico procesando tu solicitud. Intenta de nuevo.', isGroup);
        }
        continue;
      }

      if (functionCalls.length === 0) {
        // If this is the FIRST iteration and user requested an action, the model skipped tool calling.
        // Force a retry telling it to use tools.
        const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
        const finalText = normalizeOutgoingWhatsAppText(textParts.join('')).trim();
        const genericHelpResponse = isGenericHelpResponse(finalText);
        const executionDeferral = isExecutionDeferralResponse(finalText);
        const shouldRetryGenericHelp = genericHelpResponse && !isGreetingOrHelpRequest(userMessage);
        const shouldForceToolRetry = isActionRequest && (!finalText || executionDeferral || genericHelpResponse);

        if ((requiresLocalVisualEvidence && !hasLocalVisualEvidence) || (requiresLocalEvidence && !hasLocalEvidence) || (requiresRemoteEvidence && !hasRemoteEvidence)) {
          const missingEvidence: string[] = [];
          if (requiresLocalVisualEvidence && !hasLocalVisualEvidence) missingEvidence.push('evidencia visual local dentro de la app o ventana correcta');
          if (requiresLocalEvidence && !hasLocalEvidence) missingEvidence.push('evidencia local dentro de la app o computadora');
          if (requiresRemoteEvidence && !hasRemoteEvidence) missingEvidence.push('evidencia remota de web, nube o repositorio');

          response = await chatSession.sendMessage(
            `ERROR: Aun no reuniste ${missingEvidence.join(' y ')}. NO cierres la tarea con texto. Usa herramientas para obtener la evidencia faltante antes de responder al usuario.`,
          );
          continue;
        }

        if (shouldForceToolRetry) {
          if (iterations >= 2) {
            return formatForWhatsApp(
              'No pude ejecutar bien tu solicitud. Intenta de nuevo con mas detalle o dime exactamente que debo investigar o revisar.',
              isGroup,
            );
          }

          console.warn(`[WhatsApp Agent] Model skipped execution on actionable request. Retrying. Text: "${finalText.slice(0, 100)}"`);
          try {
            const retryMessage = !finalText
              ? 'ERROR: Devolviste una respuesta vacia y no ejecutaste ninguna herramienta. El usuario pidio una accion. Usa function calls ahora y despues entrega el resultado real.'
              : genericHelpResponse
                ? 'ERROR: Respondiste con una pregunta generica en lugar de atender la solicitud actual. No preguntes "en que puedo ayudarte". Ejecuta la tarea o explica el bloqueo real.'
                : 'ERROR: Prometiste que ibas a investigar o actuar pero no ejecutaste ninguna herramienta. No anuncies acciones futuras. Usa function calls ahora y responde solo cuando tengas avance real.';
            response = await chatSession.sendMessage(retryMessage);
            continue;
          } catch (retryErr: any) {
            console.error(`[WhatsApp Agent] Force-tool retry failed:`, retryErr.message);
          }
        }

        if (shouldRetryGenericHelp) {
          if (iterations >= 2) {
            return formatForWhatsApp(
              'No pude responder bien ese mensaje. Escribelo de nuevo o dime exactamente que necesitas.',
              isGroup,
            );
          }

          try {
            response = await chatSession.sendMessage(
              'ERROR: La ultima respuesta fue una pregunta generica que no atiende el mensaje actual. Responde directamente a la solicitud del usuario sin reiniciar el chat.',
            );
            continue;
          } catch (retryErr: any) {
            console.error(`[WhatsApp Agent] Generic-help retry failed:`, retryErr.message);
          }
        }

        // Update our clean history (only user/model text â€” no function roles)
        history.push({ role: 'user', parts: [{ text: userMessage }] });
        history.push({ role: 'model', parts: [{ text: finalText }] });

        // Persist model response to 3-layer memory
        if (finalText) {
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
        if (!finalText && finishReason && finishReason !== 'STOP') {
          console.error(`[WhatsApp Agent] Model returned empty text with finishReason: ${finishReason}`);
          return formatForWhatsApp('Hubo un problema procesando tu solicitud. Intenta reformular tu mensaje.', isGroup);
        }

        // If empty text with STOP, check Google connection and provide contextual help
        if (!finalText) {
          console.warn(`[WhatsApp Agent] Empty text response for message: "${userMessage.slice(0, 80)}". finishReason: ${finishReason}, iterations: ${iterations}`);

          // Check if user message was about Google services and connection is missing
          const googleKeywords = /drive|calendar|calendario|agenda|evento|gmail|email|correo/i;
          if (googleKeywords.test(userMessage) && this.calendarService) {
            const conns = this.calendarService.getConnections();
            const hasGoogle = conns.some((c: any) => c.provider === 'google' && c.isActive);
            if (!hasGoogle) {
              return formatForWhatsApp('No tengo acceso a tu cuenta de Google. Necesitas conectar Google desde SofLIA Hub (secciÃ³n Calendario) para que pueda usar Drive, Calendar y Gmail.', isGroup);
            }
          }
        }

        const fallbackResponse = isGreetingOrHelpRequest(userMessage)
          ? '\u00bfEn qu\u00e9 puedo ayudarte?'
          : 'No pude procesar bien tu solicitud. Intenta de nuevo con mas detalle.';
        const finalResponse = finalText || fallbackResponse;
        return formatForWhatsApp(finalResponse, isGroup);
      }


      // Execute function calls (delegated to whatsapp-tool-executor.ts)
      const toolNames = functionCalls.map((part: any) => part.functionCall?.name).filter(Boolean);
      const evidenceModes = functionCalls.map((part: any) => getEvidenceModeFromToolCall({
        name: part.functionCall?.name,
        args: part.functionCall?.args || {},
      }));
      const remoteOnlyAttempt = evidenceModes.length > 0 && evidenceModes.every((mode) => mode === 'remote');
      const localOnlyAttempt = evidenceModes.length > 0 && evidenceModes.every((mode) => mode === 'local');
      const visualLocalAttempt = evidenceModes.some((mode) => mode === 'local_visual');
      const nonVisualEvidenceAttempt = evidenceModes.some((mode) => mode === 'local' || mode === 'remote');
      if (requiresLocalEvidence && !hasLocalEvidence && remoteOnlyAttempt) {
        response = await chatSession.sendMessage(
          'ERROR: El usuario pidio validacion local y estas intentando usar solo evidencia web/remota. Primero inspecciona la app o la computadora local y despues continua.',
        );
        continue;
      }
      if (requiresLocalVisualEvidence && !hasLocalVisualEvidence && !visualLocalAttempt && nonVisualEvidenceAttempt && (remoteOnlyAttempt || localOnlyAttempt || nonVisualEvidenceAttempt)) {
        response = await chatSession.sendMessage(
          'ERROR: El usuario pidio revisar visualmente la aplicacion o ventana correcta. No basta con shell, archivos o Git. Usa evidencia visual real con use_computer o captura de pantalla antes de concluir.',
        );
        continue;
      }
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
            ? ` DetectÃ© fallos repetidos con ${toolNames.join(', ')}.`
            : ` DetectÃ© que ${toolNames.join(', ')} se repite sin progreso.`;
          return formatForWhatsApp(
            `La tarea entrÃ³ en un ciclo sin avance.${suffix} Necesito cambiar de estrategia o que me des un dato adicional para continuar.`,
            isGroup,
          );
        }

        response = await chatSession.sendMessage(
          `ALERTA DEL SISTEMA: EstÃ¡s repitiendo exactamente las mismas herramientas con los mismos parÃ¡metros (${toolNames.join(', ')}) sin seÃ±ales de avance. NO vuelvas a ejecutar ese mismo ciclo. Analiza los resultados previos, cambia de estrategia, usa otras herramientas o responde al usuario con el bloqueo real.`,
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
        skipConfirmations: options.skipConfirmations === true,
        requestConfirmation: (j, s, t, d, a) => this.requestConfirmation(j, s, t, d, a),
      };
      const { responses: functionResponses, bulkLabelsToVerify } = await executeWhatsAppTools(
        functionCalls, toolCtx, jid, senderNumber, isGroup,
      );

      functionCalls.forEach((part: any, index: number) => {
        const toolName = part.functionCall?.name;
        const toolArgs = part.functionCall?.args || {};
        const toolResult = functionResponses[index]?.functionResponse?.response;
        const toolFailed = toolResult?.success === false || typeof toolResult?.error === 'string';
        if (!toolName || toolFailed) return;

        const evidenceMode = getEvidenceModeFromToolCall({ name: toolName, args: toolArgs });
        if (evidenceMode === 'local') hasLocalEvidence = true;
        if (evidenceMode === 'local_visual') {
          hasLocalVisualEvidence = true;
          hasLocalEvidence = true;
        }
        if (evidenceMode === 'remote') hasRemoteEvidence = true;
      });

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
            `La tarea quedÃ³ bloqueada por fallos repetidos.${lastError ? ` Ãšltimo error: ${lastError}` : ''}`,
            isGroup,
          );
        }

        response = await chatSession.sendMessage(
          `ALERTA DEL SISTEMA: Acabas de repetir el mismo fallo con ${toolNames.join(', ')}. NO reintentes exactamente igual. Usa los errores previos para cambiar de estrategia o explica con precisiÃ³n quÃ© configuraciÃ³n, credencial o dato falta.`,
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
            'La tarea sigue en espera sin cambios reales. Necesito mÃ¡s tiempo, otra estrategia o intervenciÃ³n del usuario para continuar.',
            isGroup,
          );
        }

        response = await chatSession.sendMessage(
          `ALERTA DEL SISTEMA: EstÃ¡s haciendo polling sin cambios reales con ${toolNames.join(', ')}. No sigas consultando igual. Decide si debes esperar mÃ¡s, cambiar de herramienta o informar el estado actual al usuario.`,
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
              remainingWarnings.push(`"${labelId}" aÃºn tiene ${check.messages.length}+ correos`);
            }
          }
          if (remainingWarnings.length > 0) {
            const verificationMsg = `âš ï¸ VERIFICACIÃ“N AUTOMÃTICA: Las siguientes etiquetas AÃšN tienen correos sin procesar: ${remainingWarnings.join(', ')}. DEBES continuar procesando estos correos â€” llama gmail_get_messages para cada etiqueta pendiente y repite el proceso hasta que todas estÃ©n vacÃ­as. NO respondas al usuario hasta completar TODO.`;
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
    const emoji = toolName === 'delete_item' ? 'ðŸ—‘ï¸' : 'ðŸ“§';
    await this.waService.sendText(
      jid,
      `${emoji} *ConfirmaciÃ³n requerida*\n\n${description}\n\nÂ¿Confirmas? Responde *SI* para proceder o cualquier otra cosa para cancelar.`
    );

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        pendingConfirmations.delete(senderNumber);
        resolve(false);
        this.waService.sendText(jid, 'Tiempo de confirmaciÃ³n agotado. AcciÃ³n cancelada.');
      }, 60000); // 1 minute timeout

      pendingConfirmations.set(senderNumber, { toolName, args, resolve, timeout });
    });
  }
}
