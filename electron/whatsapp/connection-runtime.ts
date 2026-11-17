import fs from 'node:fs/promises';
import { AUTH_DIR } from './config';
import { logger } from './logger';
import { registerConnectionEvents } from './connection-events';
import { registerMessageEvents } from './message-events';
import { registerCallEvents } from './call-events';
import { registerDeliveryEvents } from './delivery-events';
import type { WhatsAppServiceCore } from './types';

/** SDK y callbacks pesados sólo se materializan cuando se solicita conexión. */
export async function openWhatsAppConnection(service: WhatsAppServiceCore, current: () => boolean): Promise<void> {
  if (!current()) return;
  const {
    default: makeWASocket,
    DisconnectReason,
    downloadMediaMessage,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    useMultiFileAuthState,
  } = await import('@whiskeysockets/baileys');
  if (!current()) return;
  await fs.mkdir(AUTH_DIR, { recursive: true });
  if (!current()) return;
  // Baileys no expone un hook React pese al prefijo de esta API.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  if (!current()) return;
  const { version } = await fetchLatestBaileysVersion();
  if (!current()) return;
  service.sock = makeWASocket({ version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger, printQRInTerminal: false, generateHighQualityLinkPreview: false,
    getMessage: async () => undefined,
  });
  registerConnectionEvents(service, saveCreds, DisconnectReason.loggedOut);
  registerMessageEvents(service, downloadMediaMessage);
  registerCallEvents(service);
  registerDeliveryEvents(service);
}
