import type { WASocket } from '@whiskeysockets/baileys';

export async function sendWhatsAppTextMessage(socket: WASocket | null, jid: string, text: string): Promise<void> {
  if (!socket) {
    console.error('[WhatsAppRemoteHub] No socket para enviar mensaje');
    return;
  }

  try {
    await socket.sendMessage(jid, { text });
  } catch (error) {
    console.error('[WhatsAppRemoteHub] Error enviando mensaje:', error);
  }
}
