export type WhatsAppGroupPolicy = 'open' | 'allowlist' | 'disabled';
export type WhatsAppGroupActivation = 'mention' | 'always';
export type WhatsAppPersonaTone = 'professional' | 'warm' | 'emotional_support' | 'direct' | 'custom';

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

export interface WhatsAppStatus {
  connected: boolean;
  phoneNumber: string | null;
  qr: string | null;
  allowedNumbers: string[];
  whitelistEnabled: boolean;
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
      setAllowedNumbers: (numbers: string[]) => Promise<any>;
      setGroupConfig: (config: any) => Promise<any>;
      setPersonalization: (update: WhatsAppPersonalizationUpdate) => Promise<any>;
      setApiKey: (apiKey: string) => Promise<any>;
      onQR: (cb: (qr: string) => void) => void;
      onStatusChange: (cb: (status: WhatsAppStatus) => void) => void;
      removeListeners: () => void;
    };
  }
}
