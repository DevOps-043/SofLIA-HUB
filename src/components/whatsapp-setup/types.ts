export type WhatsAppGroupPolicy = 'open' | 'allowlist' | 'disabled';
export type WhatsAppGroupActivation = 'mention' | 'always';
export type WhatsAppPersonaTone = 'professional' | 'warm' | 'emotional_support' | 'direct' | 'custom';
export type WhatsAppAccessPermission =
  | 'files_read'
  | 'files_write'
  | 'screen_view'
  | 'computer_control'
  | 'shell'
  | 'clipboard'
  | 'google_workspace'
  | 'messaging'
  | 'system_control'
  | 'automation'
  | 'remote_nodes';

export interface WhatsAppAgentPersonalization {
  displayName: string;
  userAlias: string;
  tone: WhatsAppPersonaTone;
  responseStyle: string;
  context: string;
  customInstructions: string;
  flowInstructions: string;
}

export interface WhatsAppPersonalizationUpdate {
  whitelistEnabled?: boolean;
  globalPersonalization?: WhatsAppAgentPersonalization;
  contactPersonalizations?: Record<string, WhatsAppAgentPersonalization | null>;
  groupPersonalizations?: Record<string, WhatsAppAgentPersonalization | null>;
}

export interface WhatsAppAccessConfigUpdate {
  masterNumber?: string | null;
  contactPermissions?: Record<string, WhatsAppAccessPermission[] | null>;
}

export interface WhatsAppConversationHistoryEvent {
  id: string;
  timestamp: string;
  direction: 'incoming' | 'outgoing' | 'system';
  kind: 'text' | 'command' | 'media' | 'audio' | 'file' | 'tool' | 'transcription';
  jid: string;
  senderNumber?: string | null;
  groupJid?: string | null;
  isGroup: boolean;
  text?: string;
  media?: { fileName?: string; mimetype?: string; sizeBytes?: number };
  tool?: { names: string[]; summary: Array<Record<string, unknown>> };
  source: 'whatsapp-service' | 'whatsapp-agent' | 'tool-loop';
  metadata?: Record<string, unknown>;
}

export interface WhatsAppConversationHistoryStats {
  total: number;
  incoming: number;
  outgoing: number;
  system: number;
  text: number;
  command: number;
  media: number;
  audio: number;
  file: number;
  tool: number;
  transcription: number;
  lastEventAt: string | null;
  byContact: Array<{ senderNumber: string; count: number; lastEventAt: string }>;
}

export interface WhatsAppConversationHistoryFilters {
  jid?: string;
  senderNumber?: string;
  query?: string;
  direction?: WhatsAppConversationHistoryEvent['direction'];
  kind?: WhatsAppConversationHistoryEvent['kind'];
  since?: string | number | Date;
  until?: string | number | Date;
  limit?: number;
}

export interface WhatsAppStatus {
  connected: boolean;
  phoneNumber: string | null;
  qr: string | null;
  allowedNumbers: string[];
  whitelistEnabled: boolean;
  masterNumber: string;
  contactPermissions: Record<string, WhatsAppAccessPermission[]>;
  groupPolicy: WhatsAppGroupPolicy;
  groupActivation: WhatsAppGroupActivation;
  groupPrefix: string;
  allowedGroups: string[];
  groupAllowFrom: string[];
  globalPersonalization: WhatsAppAgentPersonalization;
  contactPersonalizations: Record<string, WhatsAppAgentPersonalization>;
  groupPersonalizations: Record<string, WhatsAppAgentPersonalization>;
}

export interface WhatsAppSetupProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey?: string;
  embedded?: boolean;
}

declare global {
  interface Window {
    whatsApp?: {
      connect: () => Promise<any>;
      disconnect: () => Promise<any>;
      getStatus: () => Promise<WhatsAppStatus>;
      getConversationHistory: (filters?: WhatsAppConversationHistoryFilters) => Promise<{ success: boolean; data?: WhatsAppConversationHistoryEvent[]; error?: string }>;
      getConversationHistoryStats: () => Promise<{ success: boolean; data?: WhatsAppConversationHistoryStats; error?: string }>;
      setAllowedNumbers: (numbers: string[]) => Promise<any>;
      setAccessConfig: (config: WhatsAppAccessConfigUpdate) => Promise<any>;
      setGroupConfig: (config: any) => Promise<any>;
      setPersonalization: (update: WhatsAppPersonalizationUpdate) => Promise<any>;
      setApiKey: (apiKey: string) => Promise<any>;
      onQR: (cb: (qr: string) => void) => void;
      onStatusChange: (cb: (status: WhatsAppStatus) => void) => void;
      removeListeners: () => void;
    };
  }
}
