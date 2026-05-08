export type GmailTriageDecision = 'reply' | 'label_only' | 'schedule' | 'notify_chat' | 'ignore';

export interface GmailTriageOutput {
  decision: GmailTriageDecision;
  summary: string;
  rationale: string;
  labelsToAdd: string[];
  archive: boolean;
  confidence: number;
  reply?: { subject: string; body: string };
  calendarEvent?: {
    title: string;
    startIso: string;
    endIso: string;
    description: string;
    location?: string;
  };
  chatNotification?: { text: string };
}
