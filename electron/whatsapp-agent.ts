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
import type { WorkflowHubService } from './workflow-hub-service';
import type { MeetingWorkflowService } from './meetings/meeting-workflow-service';
import { SmartSearchTool } from './smart-search-tool';
import { handleSlashChatCommand } from './wa-agent/agent-chat-command';
import { handleWhatsAppAudioMessage } from './wa-agent/audio-message-handler';
import { handleWhatsAppMediaMessage } from './wa-agent/media-message-runner';
import { handleScheduledWhatsAppTask } from './wa-agent/scheduled-task-trigger';
import { handleWhatsAppTextMessage } from './wa-agent/text-message-handler';
import { requestWhatsAppToolConfirmation } from './wa-agent/tool-confirmation';
import { runWhatsAppAgentLoop } from './wa-agent/agent-loop';
import type { AgentLoopOptions, PendingConfirmation } from './wa-agent/types';

type GeminiTextHistoryEntry = { role: string; parts: Array<{ text: string }> };

const conversations = new Map<string, GeminiTextHistoryEntry[]>();
const pendingConfirmations = new Map<string, PendingConfirmation>();

export class WhatsAppAgent {
  genAI: GoogleGenerativeAI | null = null;
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
  workflowHubService: WorkflowHubService | null = null;

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
  setWorkflowHubService(service: WorkflowHubService): void { this.workflowHubService = service; console.log('[WhatsApp Agent] Workflow hub service connected'); }
  setNeuralOrganizer(service: NeuralOrganizerService): void { this.neuralOrganizer = service; console.log('[WhatsApp Agent] Neural Organizer connected'); }
  updateApiKey(key: string): void { this.apiKey = key; this.genAI = null; }
  getGenAI(): GoogleGenerativeAI { this.genAI ||= new GoogleGenerativeAI(this.apiKey); return this.genAI; }

  handleMessage(jid: string, senderNumber: string, text: string, isGroup = false, groupPassiveHistory = ''): Promise<void> {
    return handleWhatsAppTextMessage({ waService: this.waService, workflowHubService: this.workflowHubService, conversations, pendingConfirmations, handleChatCommand: (...args) => this.handleChatCommand(...args), runAgentLoop: (...args) => this.runAgentLoop(...args), jid, senderNumber, text, isGroup, groupPassiveHistory });
  }
  handleScheduledTaskTrigger(jid: string, senderNumber: string, task: ScheduledTaskInfo): Promise<void> {
    return handleScheduledWhatsAppTask({ waService: this.waService, runAgentLoop: (...args) => this.runAgentLoop(...args), jid, senderNumber, task });
  }
  handleMedia(jid: string, senderNumber: string, buffer: Buffer, fileName: string, mimetype: string, text: string, isGroup = false, groupPassiveHistory = ''): Promise<void> {
    return handleWhatsAppMediaMessage({ waService: this.waService, runAgentLoop: (...args) => this.runAgentLoop(...args), jid, senderNumber, buffer, fileName, mimetype, text, isGroup, groupPassiveHistory });
  }
  async handleAudio(jid: string, senderNumber: string, audioBuffer: Buffer, isGroup = false, groupPassiveHistory = ''): Promise<void> {
    await handleWhatsAppAudioMessage({ waService: this.waService, getGenAI: () => this.getGenAI(), jid, senderNumber, audioBuffer, isGroup, groupPassiveHistory, handleTextMessage: (targetJid, sender, message, group, history) => this.handleMessage(targetJid, sender, message, group, history) });
  }

  private handleChatCommand(jid: string, senderNumber: string, text: string, isGroup: boolean): Promise<string | null> {
    return handleSlashChatCommand({ jid, senderNumber, text, isGroup, agent: this, conversations, memory: this.memory, waService: this.waService, workflowHubService: this.workflowHubService, workspaceAutomationService: this.workspaceAutomationService });
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
