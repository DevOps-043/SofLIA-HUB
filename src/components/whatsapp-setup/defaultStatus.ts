import type { WhatsAppStatus } from './types';

export const DEFAULT_WHATSAPP_PERSONALIZATION = {
  displayName: 'Pulse',
  userAlias: '',
  tone: 'professional' as const,
  responseStyle: 'Responde en espanol, de forma clara, util y respetuosa.',
  context: '',
  customInstructions: '',
  flowInstructions: 'Los flujos activos y pasivos deben ejecutarse para el remitente actual y respetar sus permisos.',
};

export const DEFAULT_WHATSAPP_STATUS: WhatsAppStatus = {
  connected: false,
  phoneNumber: null,
  qr: null,
  allowedNumbers: [],
  whitelistEnabled: false,
  masterNumber: '',
  masterPermissions: [
    'files_read',
    'files_write',
    'screen_view',
    'computer_control',
    'shell',
    'clipboard',
    'google_workspace',
    'messaging',
    'system_control',
    'automation',
    'remote_nodes',
  ],
  contactPermissions: {},
  groupPolicy: 'open',
  groupActivation: 'mention',
  groupPrefix: '/soflia',
  allowedGroups: [],
  groupAllowFrom: [],
  globalPersonalization: DEFAULT_WHATSAPP_PERSONALIZATION,
  contactPersonalizations: {},
  groupPersonalizations: {},
};
