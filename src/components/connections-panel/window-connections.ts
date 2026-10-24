import type { CalendarBridge } from '../../shared/calendar';
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
    calendar?: CalendarBridge;
  }
}
