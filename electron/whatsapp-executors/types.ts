/**
 * Tipos compartidos para los executors de WhatsApp tools.
 */
import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { WhatsAppService } from '../whatsapp-service';
import type { CalendarService } from '../calendar-service';
import type { GmailService } from '../gmail-service';
import type { DriveService } from '../drive-service';
import type { GChatService } from '../gchat-service';
import type { MemoryService } from '../memory-service';
import type { KnowledgeService } from '../knowledge-service';
import type { AutoDevService } from '../autodev-service';
import type { DesktopAgentService } from '../desktop-agent-service';
import type { ClipboardAIAssistant } from '../clipboard-ai-assistant';
import type { TaskScheduler } from '../task-scheduler';
import type { NeuralOrganizerService } from '../neural-organizer';
import type { SmartSearchTool } from '../smart-search-tool';

export interface ToolExecutorContext {
  waService: WhatsAppService;
  calendarService: CalendarService | null;
  gmailService: GmailService | null;
  driveService: DriveService | null;
  gchatService: GChatService | null;
  autoDevService: AutoDevService | null;
  desktopAgent: DesktopAgentService | null;
  clipboardAssistant: ClipboardAIAssistant | null;
  taskScheduler: TaskScheduler | null;
  neuralOrganizer: NeuralOrganizerService | null;
  smartSearch: SmartSearchTool | null;
  memory: MemoryService;
  knowledge: KnowledgeService;
  getGenAI: () => GoogleGenerativeAI;
  requestConfirmation: (jid: string, senderNumber: string, toolName: string, description: string, args: Record<string, any>) => Promise<boolean>;
}

export type FunctionResponse = { functionResponse: { name: string; response: any } };

/** Helper para construir una respuesta de tool */
export function toolResponse(name: string, response: any): FunctionResponse {
  return { functionResponse: { name, response } };
}

/** Helper para respuestas de error */
export function toolError(name: string, error: string): FunctionResponse {
  return { functionResponse: { name, response: { success: false, error } } };
}
