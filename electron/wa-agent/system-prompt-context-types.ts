import type { CalendarService } from '../calendar-service';
import type { KnowledgeService } from '../knowledge-service';
import type { MemoryService } from '../memory-service';
import type { WhatsAppConfig } from '../whatsapp/types';

export interface WhatsAppAgentPromptContextInput {
  calendarService: CalendarService | null;
  whatsappConfig: WhatsAppConfig;
  memory: MemoryService;
  knowledge: KnowledgeService;
  jid: string;
  senderNumber: string;
  userMessage: string;
  isGroup: boolean;
  groupPassiveHistory: string;
}
