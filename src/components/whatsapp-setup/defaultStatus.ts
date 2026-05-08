import type { WhatsAppStatus } from './types';

export const DEFAULT_WHATSAPP_STATUS: WhatsAppStatus = {
  connected: false,
  phoneNumber: null,
  qr: null,
  allowedNumbers: [],
  groupPolicy: 'open',
  groupActivation: 'mention',
  groupPrefix: '/soflia',
  allowedGroups: [],
  groupAllowFrom: [],
};
