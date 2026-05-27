import type { WASocket } from '@whiskeysockets/baileys';

export interface WhatsAppConfig {
  allowedNumbers: string[];
  whitelistEnabled: boolean;
  autoConnect: boolean;
  apiKey?: string;
  allowedGroups: string[];
  groupPolicy: 'open' | 'allowlist' | 'disabled';
  groupAllowFrom: string[];
  groupActivation: 'mention' | 'always';
  groupPrefix: string;
  globalPersonalization: WhatsAppAgentPersonalization;
  contactPersonalizations: Record<string, WhatsAppAgentPersonalization>;
  groupPersonalizations: Record<string, WhatsAppAgentPersonalization>;
}

export type WhatsAppPersonaTone =
  | 'professional'
  | 'warm'
  | 'emotional_support'
  | 'direct'
  | 'custom';

export interface WhatsAppAgentPersonalization {
  displayName: string;
  userAlias: string;
  tone: WhatsAppPersonaTone;
  responseStyle: string;
  context: string;
  customInstructions: string;
  flowInstructions: string;
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
  whitelistEnabled: false,
  autoConnect: false,
  allowedGroups: [],
  groupPolicy: 'open',
  groupAllowFrom: [],
  groupActivation: 'mention',
  groupPrefix: '/soflia',
  globalPersonalization: {
    displayName: 'SofLIA',
    userAlias: '',
    tone: 'professional',
    responseStyle: 'Responde en espanol, de forma clara, util y respetuosa.',
    context: '',
    customInstructions: '',
    flowInstructions: 'Los flujos activos y pasivos deben ejecutarse para el remitente actual y respetar sus permisos.',
  },
  contactPersonalizations: {},
  groupPersonalizations: {},
};
