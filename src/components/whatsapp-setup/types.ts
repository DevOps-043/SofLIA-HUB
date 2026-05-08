export type WhatsAppGroupPolicy = 'open' | 'allowlist' | 'disabled';
export type WhatsAppGroupActivation = 'mention' | 'always';

export interface WhatsAppStatus {
  connected: boolean;
  phoneNumber: string | null;
  qr: string | null;
  allowedNumbers: string[];
  groupPolicy: WhatsAppGroupPolicy;
  groupActivation: WhatsAppGroupActivation;
  groupPrefix: string;
  allowedGroups: string[];
  groupAllowFrom: string[];
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
      setApiKey: (apiKey: string) => Promise<any>;
      onQR: (cb: (qr: string) => void) => void;
      onStatusChange: (cb: (status: WhatsAppStatus) => void) => void;
      removeListeners: () => void;
    };
  }
}
