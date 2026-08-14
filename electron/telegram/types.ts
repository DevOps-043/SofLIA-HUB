import type { RemoteNodeService } from '../remote-node-service';
import type { WorkspaceAutomationService } from '../workspace-automation-service';
import type { CommunicationHubService } from '../communication-hub/service';

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  pollIntervalMs: number;
  allowedChatIds: string[];
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

export interface TelegramState {
  config: TelegramConfig;
  lastUpdateId: number;
  recentChats: TelegramRecentChat[];
  lastPollAt?: string | null;
  lastError?: string | null;
  botInfo?: TelegramBotInfo | null;
}

export interface TelegramDeps {
  workspaceAutomationService: WorkspaceAutomationService;
  remoteNodeService: RemoteNodeService;
  communicationHubService?: CommunicationHubService;
  /**
   * Ejecuta un turno del agente con las instrucciones de una Skill anexadas.
   *
   * Se inyecta en vez de importarse para que Telegram no dependa del agente de
   * WhatsApp: el canal ofrece Skills, y quien las ejecuta es una decision del
   * arranque. Ausente = el canal no puede ejecutar Skills todavia.
   */
  runSkillTurn?: (input: {
    chatId: string;
    userId: string | null;
    prompt: string;
    isGroup: boolean;
  }) => Promise<string>;
}

export interface TelegramRuntimeContext {
  state: TelegramState;
  deps: TelegramDeps | null;
  callTelegram: (method: string, payload: Record<string, any>) => Promise<any>;
  sendMessage: (chatId: string, text: string) => Promise<Record<string, any>>;
  saveState: () => void;
  isPolling: () => boolean;
  setPolling: (polling: boolean) => void;
  isStopRequested: () => boolean;
  setStopRequested: (stopRequested: boolean) => void;
}

export type TelegramConfigUpdates = Partial<{
  enabled: boolean;
  bot_token: string;
  poll_interval_ms: number;
  allowed_chat_ids: string[];
  reset_offset: boolean;
}>;
