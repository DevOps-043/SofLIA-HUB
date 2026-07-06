import type {
  WhatsAppConversationHistoryEvent,
  WhatsAppConversationHistoryFilters,
  WhatsAppConversationHistoryStats,
  WhatsAppAccessConfigUpdate,
  WhatsAppPersonalizationUpdate,
  WhatsAppStatus,
} from '../whatsapp-setup/types';

export {};

type CalendarProvider = 'google' | 'microsoft';
type CalendarConnectionSnapshot = { provider: CalendarProvider; email?: string; isActive: boolean };
type CalendarConnectionEvent = { provider: CalendarProvider; email?: string };
type CalendarPollEvent = { events?: any[] };

declare global {
  interface Window {
    whatsApp?: {
      connect: () => Promise<{ success: boolean; error?: string }>;
      disconnect: () => Promise<{ success: boolean; error?: string }>;
      getStatus: () => Promise<WhatsAppStatus>;
      getConversationHistory: (filters?: WhatsAppConversationHistoryFilters) => Promise<{ success: boolean; data?: WhatsAppConversationHistoryEvent[]; error?: string }>;
      getConversationHistoryStats: (actor?: { userId?: string | null; organizationId?: string | null }) => Promise<{ success: boolean; data?: WhatsAppConversationHistoryStats; error?: string }>;
      setAllowedNumbers: (numbers: string[], actor?: { userId?: string | null; organizationId?: string | null }) => Promise<{ success: boolean; error?: string }>;
      setAccessConfig: (config: WhatsAppAccessConfigUpdate) => Promise<{ success: boolean; error?: string }>;
      setGroupConfig: (config: Partial<WhatsAppStatus> & { actor?: { userId?: string | null; organizationId?: string | null } }) => Promise<{ success: boolean; error?: string }>;
      setPersonalization: (update: WhatsAppPersonalizationUpdate) => Promise<{ success: boolean; error?: string }>;
      setApiKey: (apiKey: string) => Promise<unknown>;
      onQR: (callback: (qr: string) => void) => void;
      onStatusChange: (callback: (status: WhatsAppStatus) => void) => void;
      removeListeners: () => void;
    };
    calendar?: {
      getConnections: () => Promise<CalendarConnectionSnapshot[]>;
      onConnected: (callback: (data: CalendarConnectionEvent) => void) => void;
      onDisconnected: (callback: (data: CalendarConnectionEvent) => void) => void;
      removeListeners: () => void;
      connectGoogle: () => Promise<{ success: boolean; email?: string; error?: string }>;
      connectMicrosoft: () => Promise<{ success: boolean; email?: string; error?: string }>;
      disconnect: (provider: CalendarProvider) => Promise<unknown>;
      getEvents: () => Promise<any[]>;
      startAuto: () => Promise<void>;
      stopAuto: () => Promise<void>;
      getStatus: () => Promise<{ isPolling: boolean; inWorkHours: boolean; currentEvent: unknown | null }>;
      onWorkStart: (callback: (data: unknown) => void) => void;
      onWorkEnd: (callback: (data: unknown) => void) => void;
      onPoll: (callback: (data: CalendarPollEvent) => void) => void;
    };
  }
}
