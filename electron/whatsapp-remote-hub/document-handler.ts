import { downloadMediaMessage } from '@whiskeysockets/baileys';
import type { WAMessage, WASocket } from '@whiskeysockets/baileys';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDocumentMessage } from './message-parsing';
import type { PendingConversion, SendTextMessage } from './types';

const VALID_TEXT_MIMES = ['text/plain', 'application/json', 'text/csv', 'application/javascript'];

interface IncomingDocumentOptions {
  socket: WASocket | null;
  message: WAMessage;
  jid: string;
  pendingConversions: Map<string, PendingConversion>;
  sendMessage: SendTextMessage;
}

function isSupportedTextDocument(fileName: string, mimetype: string): boolean {
  return VALID_TEXT_MIMES.includes(mimetype) || fileName.endsWith('.txt') || fileName.endsWith('.md');
}

export async function handleIncomingDocument(options: IncomingDocumentOptions): Promise<void> {
  const { socket, message, jid, pendingConversions, sendMessage } = options;
  try {
    if (!socket) return;
    const documentMessage = getDocumentMessage(message);
    if (!documentMessage) return;

    const fileName = path.basename(documentMessage.fileName || 'documento.txt');
    const mimetype = documentMessage.mimetype || '';
    if (!isSupportedTextDocument(fileName, mimetype)) {
      await sendMessage(jid, `Documento Recibido:\n_${fileName}_\n\nPor ahora Quick-Conversion solo soporta archivos de texto puro.`);
      return;
    }

    await sendMessage(jid, `Descargando documento \`${fileName}\` para Quick-Conversion...`);
    const buffer = await downloadMediaMessage(message, 'buffer', {});
    const tempPath = path.join(os.tmpdir(), `wa_doc_${Date.now()}_${fileName}`);
    fs.writeFileSync(tempPath, buffer as Buffer);

    pendingConversions.set(jid, {
      id: `conv_${Date.now()}`,
      jid,
      filePath: tempPath,
      fileName,
      timestamp: Date.now(),
    });

    await sendMessage(jid, `Documento Procesado:\n_${fileName}_\n\nQue instrucciones deseas ejecutar?\n\nResponde con:\n- Generar PDF\n- Resumir`);
  } catch (error: any) {
    console.error('[WhatsAppRemoteHub] Error al manejar documento:', error);
    await sendMessage(jid, `Error al procesar el documento: ${error.message}`);
  }
}
