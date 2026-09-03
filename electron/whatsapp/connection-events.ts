import { DisconnectReason } from '@whiskeysockets/baileys';
import fs from 'node:fs/promises';
import QRCode from 'qrcode';
import { AUTH_DIR, saveConfig } from './config';
import type { WhatsAppServiceCore } from './types';

export function registerConnectionEvents(service: WhatsAppServiceCore, saveCreds: () => Promise<void> | void): void {
  const sock = service.sock!;

  service.sock!.ev.on('connection.update', async (update) => {
    // Un socket reemplazado sigue emitiendo mientras se cierra. Sin esta guarda
    // su evento de cierre tardio marcaba `connected = false` sobre la conexion
    // nueva y sana, y a partir de ahi todo envio fallaba con "no esta
    // conectado" aunque el canal estuviera abierto.
    if (isSupersededSocket(service, sock)) return;
    const { connection, lastDisconnect, qr } = update;
    if (qr) await handleQr(service, qr);
    if (connection === 'open') await handleOpen(service);
    if (connection === 'close') await handleClose(service, (lastDisconnect?.error as any)?.output?.statusCode);
  });

  service.sock!.ev.on('creds.update', saveCreds);
}

function isSupersededSocket(service: WhatsAppServiceCore, sock: unknown): boolean {
  return Boolean(service.sock) && service.sock !== sock;
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
  service.lastDeliveryError = null;
  service.phoneNumber = service.sock?.user?.id?.split(':')[0] || null;
  service.config.autoConnect = true;
  await saveConfig(service.config);
  service.emit('connected', service.phoneNumber);
  service.emit('status', service.getStatus());
  console.log('[WhatsApp] Connected:', service.phoneNumber);
}

async function handleClose(service: WhatsAppServiceCore, statusCode: number): Promise<void> {
  service.connected = false;
  const closingSock = service.sock;
  const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
  if (shouldReconnect && service.reconnectAttempts < service.maxReconnectAttempts) {
    service.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, service.reconnectAttempts), 30000);
    console.log(`[WhatsApp] Reconnecting in ${delay}ms (attempt ${service.reconnectAttempts})...`);
    service.sock = null;
    endSocket(closingSock);
    setTimeout(() => service.connect(), delay);
  } else {
    console.log('[WhatsApp] Disconnected permanently.');
    service.sock = null;
    endSocket(closingSock);
    if (statusCode === DisconnectReason.loggedOut) {
      await fs.rm(AUTH_DIR, { recursive: true, force: true });
      service.config.autoConnect = false;
      await saveConfig(service.config);
    }
  }
  service.emit('disconnected', statusCode);
  service.emit('status', service.getStatus());
}

/**
 * Cierra el transporte del socket saliente.
 *
 * Sin esto el websocket anterior podia seguir vivo junto al nuevo, procesando
 * los mismos mensajes por duplicado y compitiendo por el estado del servicio.
 */
function endSocket(sock: { end?: (error?: Error) => void } | null): void {
  try {
    sock?.end?.(undefined);
  } catch (err) {
    console.warn('[WhatsApp] No se pudo cerrar el socket anterior:', err);
  }
}
