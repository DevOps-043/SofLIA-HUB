import type { MeetingWorkflowService } from '../meetings/meeting-workflow-service';
import type { WhatsAppService } from '../whatsapp-service';

export interface MeetingCommandInput {
  jid: string;
  lower: string;
  runId: string;
  senderNumber: string;
  text: string;
  waService: WhatsAppService;
  workflowService: MeetingWorkflowService;
  refreshTimeout: () => void;
}

export interface MeetingCommandResult {
  keepActive: boolean;
}
