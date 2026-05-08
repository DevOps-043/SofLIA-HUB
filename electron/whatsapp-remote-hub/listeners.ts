import type { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { getIncomingText, hasIncomingMedia, isDocumentMessage } from './message-parsing';

interface RemoteHubListenersOptions {
  socket: WASocket | null;
  handleIncomingDocument: (message: WAMessage, jid: string) => Promise<void>;
  processIncomingText: (text: string, jid: string, messageId?: string | null, message?: WAMessage) => Promise<void>;
}

export function setupRemoteHubListeners(options: RemoteHubListenersOptions): void {
  const { socket, handleIncomingDocument, processIncomingText } = options;
  if (!socket) return;

  socket.ev.on('messages.upsert', async (event: any) => {
    try {
      if (event.type !== 'notify') return;

      for (const message of event.messages) {
        if (!message.message || message.key.fromMe) continue;

        const jid = message.key.remoteJid;
        if (!jid) continue;

        if (hasIncomingMedia(message) && isDocumentMessage(message)) {
          await handleIncomingDocument(message, jid);
          continue;
        }

        const text = getIncomingText(message);
        if (text) {
          await processIncomingText(text, jid, message.key.id, message);
        }
      }
    } catch (error) {
      console.error('[WhatsAppRemoteHub] Error procesando mensaje:', error);
    }
  });
}
