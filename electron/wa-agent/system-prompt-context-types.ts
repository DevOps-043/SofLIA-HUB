import type { CalendarService } from '../calendar-service';
import type { KnowledgeService } from '../knowledge-service';
import type { MemoryService } from '../memory-service';

export interface WhatsAppAgentPromptContextInput {
  calendarService: CalendarService | null;
  memory: MemoryService;
  knowledge: KnowledgeService;
  jid: string;
  senderNumber: string;
  userMessage: string;
  isGroup: boolean;
  groupPassiveHistory: string;
}
