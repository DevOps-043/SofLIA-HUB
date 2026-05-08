import type { WASocket } from '@whiskeysockets/baileys';

export interface WhatsAppConfig {
  allowedNumbers: string[];
  autoConnect: boolean;
  apiKey?: string;
  allowedGroups: string[];
  groupPolicy: 'open' | 'allowlist' | 'disabled';
  groupAllowFrom: string[];
  groupActivation: 'mention' | 'always';
  groupPrefix: string;
}

export interface WhatsAppServiceCore {
  sock: WASocket | null;
  config: WhatsAppConfig;
  connected: boolean;
  qrDataUrl: string | null;
  phoneNumber: string | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  groupContext: Map<string, Array<{ sender: string; text: string; timestamp: number }>>;
  emit(eventName: string, ...args: any[]): boolean;
  connect(): Promise<void>;
  getStatus(): Record<string, any>;
}

export const DEFAULT_CONFIG: WhatsAppConfig = {
  allowedNumbers: [],
  autoConnect: false,
  allowedGroups: [],
  groupPolicy: 'open',
  groupAllowFrom: [],
  groupActivation: 'mention',
  groupPrefix: '/soflia',
};
