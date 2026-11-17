import fs from 'node:fs/promises';
import QRCode from 'qrcode';
import { AUTH_DIR, saveConfig } from './config';
import type { WhatsAppServiceCore } from './types';
import { scheduleWhatsAppReconnect, cancelWhatsAppReconnect } from './reconnect';

export function registerConnectionEvents(
  service: WhatsAppServiceCore,
  saveCreds: () => Promise<void> | void,
  loggedOutCode: number,
): void {
  const sock = service.sock!;

  service.sock!.ev.on('connection.update', (update) => {
    void (async () => {
      // Un socket retirado puede seguir emitiendo mientras se cierra.
      if (isSupersededSocket(service, sock)) return;
      const { connection, lastDisconnect, qr } = update;
      if (qr) await handleQr(service, qr, () => !isSupersededSocket(service, sock));
      if (isSupersededSocket(service, sock)) return;
      if (connection === 'open') await handleOpen(service, () => !isSupersededSocket(service, sock));
      if (isSupersededSocket(service, sock)) return;
      if (connection === 'close') {
        await handleClose(service, (lastDisconnect?.error as any)?.output?.statusCode, loggedOutCode);
      }
    })().catch(() => console.error('[WhatsApp] No se pudo procesar el cambio de conexión.'));
  });

  service.sock!.ev.on('creds.update', () => {
    if (isSupersededSocket(service, sock)) return;
    void Promise.resolve().then(() => {
      if (!isSupersededSocket(service, sock)) return saveCreds();
    }).catch(() => console.error('[WhatsApp] No se pudieron guardar las credenciales.'));
  });
}

function isSupersededSocket(service: WhatsAppServiceCore, sock: unknown): boolean {
  return service.sock !== sock;
}

async function handleQr(service: WhatsAppServiceCore, qr: string, current: () => boolean): Promise<void> {
  try {
    const encoded = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
    if (!current()) return;
    service.qrDataUrl = encoded;
    service.emit('qr', service.qrDataUrl);
    service.emit('status', service.getStatus());
  } catch (err) {
    console.error('[WhatsApp] QR generation error:', err);
  }
}

async function handleOpen(service: WhatsAppServiceCore, current: () => boolean): Promise<void> {
  cancelWhatsAppReconnect(service);
  service.connected = true;
  service.qrDataUrl = null;
  service.reconnectAttempts = 0;
  service.lastDeliveryError = null;
  service.phoneNumber = service.sock?.user?.id?.split(':')[0] || null;
  service.config.autoConnect = true;
  await saveConfig(service.config);
  if (!current()) return;
  service.emit('connected', service.phoneNumber);
  service.emit('status', service.getStatus());
  console.log('[WhatsApp] Connected:', service.phoneNumber);
}

async function handleClose(service: WhatsAppServiceCore, statusCode: number, loggedOutCode: number): Promise<void> {
  cancelWhatsAppReconnect(service);
  service.connected = false;
  const closingSock = service.sock;
  const shouldReconnect = statusCode !== loggedOutCode;
  try {
    if (shouldReconnect && service.reconnectAttempts < service.maxReconnectAttempts) {
      service.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, service.reconnectAttempts), 30000);
      console.log(`[WhatsApp] Reconexión en ${delay} ms (intento ${service.reconnectAttempts}).`);
      service.sock = null;
      endSocket(closingSock);
      scheduleWhatsAppReconnect(service, delay);
    } else {
      console.log('[WhatsApp] Conexión finalizada.');
      service.sock = null;
      endSocket(closingSock);
      if (statusCode === loggedOutCode) {
        service.config.autoConnect = false;
        await fs.rm(AUTH_DIR, { recursive: true, force: true });
        await saveConfig(service.config);
      }
    }
  } finally {
    if (!service.sock) {
      service.emit('disconnected', statusCode);
      service.emit('status', service.getStatus());
    }
  }
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
