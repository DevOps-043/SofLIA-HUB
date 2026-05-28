import type {
  WhatsAppConversationHistoryEvent,
  WhatsAppConversationHistoryFilters,
  WhatsAppConversationHistoryStats,
  WhatsAppAccessConfigUpdate,
  WhatsAppPersonalizationUpdate,
  WhatsAppStatus,
} from '../whatsapp-setup/types';

export {};

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
      onQR: (callback: (qr: string) => void) => void;
      onStatusChange: (callback: (status: WhatsAppStatus) => void) => void;
      removeListeners: () => void;
    };
    calendar?: {
      getConnections: () => Promise<any[]>;
      onConnected: (callback: (data: any) => void) => void;
      onDisconnected: (callback: (data: any) => void) => void;
      removeListeners: () => void;
      connectGoogle: () => Promise<{ success: boolean; email?: string; error?: string }>;
      connectMicrosoft: () => Promise<{ success: boolean; email?: string; error?: string }>;
      disconnect: (provider: 'google' | 'microsoft') => Promise<any>;
      getEvents: () => Promise<any[]>;
      startAuto: () => Promise<void>;
      stopAuto: () => Promise<void>;
      getStatus: () => Promise<{ isPolling: boolean; inWorkHours: boolean; currentEvent: any | null }>;
      onWorkStart: (callback: (data: any) => void) => void;
      onWorkEnd: (callback: (data: any) => void) => void;
      onPoll: (callback: (data: any) => void) => void;
    };
  }
}
