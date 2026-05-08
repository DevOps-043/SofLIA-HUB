import type { WAMessage, WASocket } from '@whiskeysockets/baileys';
import fs from 'fs';
import { WhatsAppFileConverter } from './file-converter';
import type { PendingConversion, SendTextMessage } from './types';

interface QuickConversionOptions {
  socket: WASocket | null;
  command: string;
  pending: PendingConversion;
  jid: string;
  message?: WAMessage;
  sendMessage: SendTextMessage;
}

export async function handleQuickConversion(options: QuickConversionOptions): Promise<void> {
  const { socket, command, pending, jid, message, sendMessage } = options;
  try {
    await sendMessage(jid, `Ejecutando \`${command}\` sobre ${pending.fileName}...`);

    if (command === 'generar pdf') {
      const pdfBuffer = await WhatsAppFileConverter.convertTextToPDF(pending.filePath);
      await socket?.sendMessage(jid, {
        document: pdfBuffer,
        mimetype: 'application/pdf',
        fileName: `${pending.fileName.replace(/\.[^/.]+$/, '')}.pdf`,
      }, { quoted: message });
    } else if (command === 'resumir') {
      const summary = await WhatsAppFileConverter.summarizeText(pending.filePath);
      await sendMessage(jid, summary);
    }
  } catch (error: any) {
    console.error('[WhatsAppRemoteHub] Error en Quick-Conversion:', error);
    await sendMessage(jid, `Error durante la conversion: ${error.message}`);
  } finally {
    if (fs.existsSync(pending.filePath)) {
      fs.unlinkSync(pending.filePath);
    }
  }
}
