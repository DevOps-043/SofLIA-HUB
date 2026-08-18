import { GoogleGenAI } from '@google/genai';
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
import type { WorkspaceAutomationService } from './workspace-automation-service';
import type { PassiveSkillsService } from './passive-skills/service';
import type { MeetingWorkflowService } from './meetings/meeting-workflow-service';
import type { CommunicationHubService } from './communication-hub/service';
import { SmartSearchTool } from './smart-search-tool';
import { handleSlashChatCommand } from './wa-agent/agent-chat-command';
import { handleWhatsAppAudioMessage } from './wa-agent/audio-message-handler';
import { handleWhatsAppMediaMessage } from './wa-agent/media-message-runner';
import { handleScheduledWhatsAppTask } from './wa-agent/scheduled-task-trigger';
import { handleWhatsAppTextMessage } from './wa-agent/text-message-handler';
import { requestWhatsAppToolConfirmation } from './wa-agent/tool-confirmation';
import { runWhatsAppAgentLoop } from './wa-agent/agent-loop';
import { buildWhatsAppVoiceTransport, deliverWhatsAppAgentReply } from './wa-agent/voice-delivery';
import { openVoiceCall } from './voice-call/delivery';
import type { AgentLoopOptions, PendingConfirmation } from './wa-agent/types';

type GeminiTextHistoryEntry = { role: string; parts: Array<{ text: string }> };

const conversations = new Map<string, GeminiTextHistoryEntry[]>();
const pendingConfirmations = new Map<string, PendingConfirmation>();

export class WhatsAppAgent {
  genAI: GoogleGenerativeAI | null = null;
  genAiClient: GoogleGenAI | null = null;
  calendarService: CalendarService | null = null;
  gmailService: GmailService | null = null;
  driveService: DriveService | null = null;
  gchatService: GChatService | null = null;
  desktopAgent: DesktopAgentService | null = null;
  clipboardAssistant: ClipboardAIAssistant | null = null;
  taskScheduler: TaskScheduler | null = null;
  neuralOrganizer: NeuralOrganizerService | null = null;
  smartSearch: SmartSearchTool | null = null;
  workspaceAutomationService: WorkspaceAutomationService | null = null;
  passiveSkillsService: PassiveSkillsService | null = null;
  communicationHubService: CommunicationHubService | null = null;

  constructor(
    public waService: WhatsAppService,
    public apiKey: string,
    public memory: MemoryService,
    public knowledge: KnowledgeService,
  ) {}

  setGoogleServices(calendar: CalendarService, gmail: GmailService, drive: DriveService, gchat?: GChatService): void {
    this.calendarService = calendar; this.gmailService = gmail; this.driveService = drive; this.gchatService = gchat || null;
    console.log('[WhatsApp Agent] Google services connected (Calendar, Gmail, Drive, Chat)');
  }
  setDesktopAgentService(service: DesktopAgentService): void { this.desktopAgent = service; console.log('[WhatsApp Agent] DesktopAgent service connected'); }
  setClipboardAssistant(service: ClipboardAIAssistant): void { this.clipboardAssistant = service; console.log('[WhatsApp Agent] Clipboard AI Assistant connected'); }
  setTaskScheduler(service: TaskScheduler): void { this.taskScheduler = service; console.log('[WhatsApp Agent] Task Scheduler connected'); }
  setMeetingWorkflowService(service: MeetingWorkflowService): void { void service; console.log('[WhatsApp Agent] Meeting workflow service connected'); }
  setWorkspaceAutomationService(service: WorkspaceAutomationService): void { this.workspaceAutomationService = service; console.log('[WhatsApp Agent] Workspace automation service connected'); }
  setPassiveSkillsService(service: PassiveSkillsService): void { this.passiveSkillsService = service; console.log('[WhatsApp Agent] Passive skills service connected'); }
  setCommunicationHubService(service: CommunicationHubService): void { this.communicationHubService = service; console.log('[WhatsApp Agent] Communication Hub connected'); }
  setNeuralOrganizer(service: NeuralOrganizerService): void { this.neuralOrganizer = service; console.log('[WhatsApp Agent] Neural Organizer connected'); }
  updateApiKey(key: string): void { this.apiKey = key; this.genAI = null; this.genAiClient = null; }
  /**
   * Cliente del SDK legado, para los consumidores de un solo disparo que no
   * usan herramientas (transcripcion de audio, generacion de presentaciones).
   */
  getGenAI(): GoogleGenerativeAI { this.genAI ||= new GoogleGenerativeAI(this.apiKey); return this.genAI; }
  /**
   * Cliente de `@google/genai`, obligatorio para el agentic loop.
   *
   * El SDK legado estampa `role: "function"` en las respuestas de herramienta y
   * Gemini 3 rechaza ese rol, asi que ninguna conversacion con tools sobrevive
   * el segundo salto. El SDK nuevo las manda como `role: "user"`.
   */
  getGenAiClient(): GoogleGenAI { this.genAiClient ||= new GoogleGenAI({ apiKey: this.apiKey }); return this.genAiClient; }

  /**
   * `forceVoice` marca el turno que llego hablado: la respuesta sale hablada
   * aunque no hubiera una llamada abierta, porque exigir un comando previo para
   * que conteste con voz a quien acaba de hablarle seria un tramite inventado.
   */
  handleMessage(jid: string, senderNumber: string, text: string, isGroup = false, groupPassiveHistory = '', forceVoice = false): Promise<void> {
    return handleWhatsAppTextMessage({ waService: this.waService, passiveSkillsService: this.passiveSkillsService, conversations, pendingConfirmations, handleChatCommand: (...args) => this.handleChatCommand(...args), runAgentLoop: (...args) => this.runAgentLoop(...args), jid, senderNumber, text, isGroup, groupPassiveHistory, deliverReply: (reply) => deliverWhatsAppAgentReply(this.waService, jid, senderNumber, reply, forceVoice) });
  }

  /** Reconduce una llamada entrante de WhatsApp al modo llamada por notas de voz. */
  handleIncomingCall(jid: string, senderNumber: string): Promise<void> {
    console.log(`[WhatsApp Agent] Llamada entrante de ${senderNumber} reconducida al modo llamada.`);
    return openVoiceCall(buildWhatsAppVoiceTransport(this.waService, jid, senderNumber), 'incoming-call');
  }
  /** Devuelve el texto del resultado; la entrega la decide quien llama. */
  handleScheduledTaskTrigger(jid: string, senderNumber: string, task: ScheduledTaskInfo): Promise<string> {
    return handleScheduledWhatsAppTask({ waService: this.waService, runAgentLoop: (...args) => this.runAgentLoop(...args), jid, senderNumber, task });
  }
  handleMedia(jid: string, senderNumber: string, buffer: Buffer, fileName: string, mimetype: string, text: string, isGroup = false, groupPassiveHistory = ''): Promise<void> {
    return handleWhatsAppMediaMessage({ waService: this.waService, runAgentLoop: (...args) => this.runAgentLoop(...args), jid, senderNumber, buffer, fileName, mimetype, text, isGroup, groupPassiveHistory });
  }
  async handleAudio(jid: string, senderNumber: string, audioBuffer: Buffer, isGroup = false, groupPassiveHistory = ''): Promise<void> {
    await handleWhatsAppAudioMessage({ waService: this.waService, getGenAI: () => this.getGenAI(), jid, senderNumber, audioBuffer, isGroup, groupPassiveHistory, handleTextMessage: (targetJid, sender, message, group, history, forceVoice) => this.handleMessage(targetJid, sender, message, group, history, forceVoice) });
  }

  /**
   * Ejecuta un turno con las instrucciones de una Skill ya anexadas.
   *
   * Publico porque lo invoca el dispatcher de comandos: es el punto por el que
   * una Skill del catalogo pasa a ser un turno del agente, con el mismo bucle y
   * las mismas guardas que cualquier otro mensaje.
   */
  runSkillTurn(jid: string, senderNumber: string, prompt: string, isGroup = false): Promise<string> {
    return this.runAgentLoop(jid, senderNumber, prompt, isGroup);
  }

  private handleChatCommand(jid: string, senderNumber: string, text: string, isGroup: boolean): Promise<string | null> {
    return handleSlashChatCommand({ jid, senderNumber, text, isGroup, agent: this, conversations, memory: this.memory, waService: this.waService, workspaceAutomationService: this.workspaceAutomationService });
  }
  private runAgentLoop(jid: string, senderNumber: string, userMessage: string, isGroup = false, groupPassiveHistory = '', inlineMediaParts: Array<{ inlineData: { mimeType: string; data: string } }> = [], options: AgentLoopOptions = {}): Promise<string> {
    return runWhatsAppAgentLoop({
      agent: this,
      conversations,
      pendingConfirmations,
      requestConfirmation: (...args) => this.requestConfirmation(...args),
      jid,
      senderNumber,
      userMessage,
      isGroup,
      groupPassiveHistory,
      inlineMediaParts,
      options,
    });
  }
  public requestConfirmation(jid: string, senderNumber: string, toolName: string, description: string, args: Record<string, any>): Promise<boolean> {
    return requestWhatsAppToolConfirmation({ pendingConfirmations, waService: this.waService, jid, senderNumber, toolName, description, args });
  }
}
