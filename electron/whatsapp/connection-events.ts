import { DisconnectReason } from '@whiskeysockets/baileys';
import fs from 'node:fs/promises';
import QRCode from 'qrcode';
import { AUTH_DIR, saveConfig } from './config';
import type { WhatsAppServiceCore } from './types';

export function registerConnectionEvents(service: WhatsAppServiceCore, saveCreds: () => Promise<void> | void): void {
  service.sock!.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) await handleQr(service, qr);
    if (connection === 'open') await handleOpen(service);
    if (connection === 'close') await handleClose(service, (lastDisconnect?.error as any)?.output?.statusCode);
  });

  service.sock!.ev.on('creds.update', saveCreds);
}

async function handleQr(service: WhatsAppServiceCore, qr: string): Promise<void> {
  try {
    service.qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
    service.emit('qr', service.qrDataUrl);
    service.emit('status', service.getStatus());
  } catch (err) {
    console.error('[WhatsApp] QR generation error:', err);
  }
}

async function handleOpen(service: WhatsAppServiceCore): Promise<void> {
  service.connected = true;
  service.qrDataUrl = null;
  service.reconnectAttempts = 0;
  service.phoneNumber = service.sock?.user?.id?.split(':')[0] || null;
  service.config.autoConnect = true;
  await saveConfig(service.config);
  service.emit('connected', service.phoneNumber);
  service.emit('status', service.getStatus());
  console.log('[WhatsApp] Connected:', service.phoneNumber);
}

async function handleClose(service: WhatsAppServiceCore, statusCode: number): Promise<void> {
  service.connected = false;
  const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
  if (shouldReconnect && service.reconnectAttempts < service.maxReconnectAttempts) {
    service.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, service.reconnectAttempts), 30000);
    console.log(`[WhatsApp] Reconnecting in ${delay}ms (attempt ${service.reconnectAttempts})...`);
    service.sock = null;
    setTimeout(() => service.connect(), delay);
  } else {
    console.log('[WhatsApp] Disconnected permanently.');
    service.sock = null;
    if (statusCode === DisconnectReason.loggedOut) {
      await fs.rm(AUTH_DIR, { recursive: true, force: true });
      service.config.autoConnect = false;
      await saveConfig(service.config);
    }
  }
  service.emit('disconnected', statusCode);
  service.emit('status', service.getStatus());
}
