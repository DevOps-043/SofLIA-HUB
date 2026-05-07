/**
 * Tipos compartidos por el dispatcher de tools de WhatsApp.
 */

import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { CalendarService } from '../calendar-service';
import type { ClipboardAIAssistant } from '../clipboard-ai-assistant';
import type { DesktopAgentService } from '../desktop-agent-service';
import type { DriveService } from '../drive-service';
import type { GChatService } from '../gchat-service';
import type { GmailService } from '../gmail-service';
import type { KnowledgeService } from '../knowledge-service';
import type { MemoryService } from '../memory-service';
import type { NeuralOrganizerService } from '../neural-organizer';
import type { SmartSearchTool } from '../smart-search-tool';
import type { TaskScheduler } from '../task-scheduler';
import type { WhatsAppService } from '../whatsapp-service';

/**
 * Contexto de servicios inyectado al dispatcher.
 *
 * Algunas dependencias son opcionales (`null`) porque el usuario puede no
 * tener Google conectado o no haber configurado todos los servicios. Cada
 * handler debe verificar `!= null` antes de usarlas y devolver error útil.
 */
export interface ToolExecutorContext {
  waService: WhatsAppService;
  calendarService: CalendarService | null;
  gmailService: GmailService | null;
  driveService: DriveService | null;
  gchatService: GChatService | null;
  desktopAgent: DesktopAgentService | null;
  clipboardAssistant: ClipboardAIAssistant | null;
  taskScheduler: TaskScheduler | null;
  neuralOrganizer: NeuralOrganizerService | null;
  smartSearch: SmartSearchTool | null;
  memory: MemoryService;
  knowledge: KnowledgeService;
  getGenAI: () => GoogleGenerativeAI;
  /** Si true, se omiten todas las confirmaciones (para tests/automatización). */
  skipConfirmations?: boolean;
  requestConfirmation: (
    jid: string,
    senderNumber: string,
    toolName: string,
    description: string,
    args: Record<string, unknown>,
  ) => Promise<boolean>;
}

/** Forma de respuesta esperada por Gemini para cada function call. */
export type FunctionResponse = {
  functionResponse: { name: string; response: Record<string, unknown> };
};

export function buildResponse(name: string, response: Record<string, unknown>): FunctionResponse {
  return { functionResponse: { name, response } };
}

export function errorResponse(name: string, error: string): FunctionResponse {
  return buildResponse(name, { success: false, error });
}
