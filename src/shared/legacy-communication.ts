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
  actor?: { userId?: string | null; organizationId?: string | null };
  whitelistEnabled?: boolean;
  globalPersonalization?: WhatsAppAgentPersonalization;
  contactPersonalizations?: Record<string, WhatsAppAgentPersonalization | null>;
  groupPersonalizations?: Record<string, WhatsAppAgentPersonalization | null>;
}

export interface WhatsAppAccessConfigUpdate {
  actor?: { userId?: string | null; organizationId?: string | null };
  masterNumber?: string | null;
  masterPermissions?: WhatsAppAccessPermission[];
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
  actor?: { userId?: string | null; organizationId?: string | null };
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
  success?: boolean; error?: string;
  connected: boolean;
  phoneNumber: string | null;
  qr: string | null;
  allowedNumbers: string[];
  whitelistEnabled: boolean;
  masterNumber: string;
  masterPermissions: WhatsAppAccessPermission[];
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

export interface WhatsAppApi {
      connect: () => Promise<{ success: boolean; error?: string }>;
      disconnect: () => Promise<{ success: boolean; error?: string }>;
      getStatus: () => Promise<WhatsAppStatus>;
      getConversationHistory: (filters?: WhatsAppConversationHistoryFilters) => Promise<{ success: boolean; data?: WhatsAppConversationHistoryEvent[]; error?: string }>;
      getConversationHistoryStats: (actor?: { userId?: string | null; organizationId?: string | null }) => Promise<{ success: boolean; data?: WhatsAppConversationHistoryStats; error?: string }>;
      setAllowedNumbers: (numbers: string[], actor?: { userId?: string | null; organizationId?: string | null }) => Promise<{ success: boolean; error?: string }>;
      setAccessConfig: (config: WhatsAppAccessConfigUpdate) => Promise<{ success: boolean; error?: string }>;
      setGroupConfig: (config: Partial<WhatsAppStatus> & { actor?: { userId?: string | null; organizationId?: string | null } }) => Promise<{ success: boolean; error?: string }>;
      setPersonalization: (update: WhatsAppPersonalizationUpdate) => Promise<{ success: boolean; error?: string }>;
      setApiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
      onQR: (cb: (qr: string) => void) => void | (() => void);
      onStatusChange: (cb: (status: WhatsAppStatus) => void) => void | (() => void);
      removeListeners: () => void;
    }


export interface TelegramRecentChat {
  chatId: string;
  title: string;
  username?: string | null;
  type: string;
  lastMessageAt: string;
  lastMessagePreview: string;
}

export interface TelegramBotInfo {
  id: number;
  username?: string;
  first_name?: string;
}

export interface TelegramStatusSnapshot {
  success: boolean;
  configured: boolean;
  enabled: boolean;
  polling: boolean;
  poll_interval_ms: number;
  allowed_chat_ids: string[];
  last_poll_at: string | null;
  last_error: string | null;
  bot: TelegramBotInfo | null;
  recent_chats: TelegramRecentChat[];
  available_agents: Array<{
    id: string;
    command: string;
    description: string;
  }>;
  error?: string;
}

export interface TelegramApi {
      getStatus: () => Promise<TelegramStatusSnapshot>;
      updateConfig: (updates: {
        enabled?: boolean;
        bot_token?: string;
        poll_interval_ms?: number;
        allowed_chat_ids?: string[];
        reset_offset?: boolean;
      }) => Promise<TelegramStatusSnapshot>;
      testConnection: () => Promise<{ success: boolean; bot?: TelegramBotInfo; error?: string }>;
      sendMessage: (chatId: string, text: string) => Promise<{ success: boolean; message?: unknown; error?: string }>;
      listRecentChats: () => Promise<{ success: boolean; chats?: TelegramRecentChat[]; error?: string }>;
    }
