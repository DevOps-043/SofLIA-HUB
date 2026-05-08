import type { WASocket } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import type { SendTextMessage } from './types';
// @ts-ignore
import archiver from 'archiver';

interface SendPathAsZipOptions {
  socket: WASocket | null;
  jid: string;
  targetPath: string;
  sendMessage: SendTextMessage;
}

export async function sendPathAsZip(options: SendPathAsZipOptions): Promise<void> {
  const { socket, jid, targetPath, sendMessage } = options;
  try {
    const normalizedPath = path.resolve(targetPath);
    if (!fs.existsSync(normalizedPath)) {
      await sendMessage(jid, `La ruta especificada no existe:\n${normalizedPath}`);
      return;
    }

    await sendMessage(jid, 'Comprimiendo archivo/directorio. Esto puede tomar unos momentos.');
    const buffer = await compressPathToBuffer(normalizedPath);
    if (!socket) throw new Error('Socket no inicializado');

    const fileName = `${path.basename(normalizedPath)}.zip`;
    await socket.sendMessage(jid, {
      document: buffer,
      mimetype: 'application/zip',
      fileName,
    });
    console.log(`[WhatsAppRemoteHub] Archivo enviado: ${fileName}`);
  } catch (error: any) {
    console.error('[WhatsAppRemoteHub] Error al enviar archivo:', error);
    await sendMessage(jid, `Error al comprimir o enviar el archivo: ${error.message}`);
  }
}

export async function compressPathToBuffer(targetPath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', (error: any) => reject(error));

    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      archive.directory(targetPath, false);
    } else {
      archive.file(targetPath, { name: path.basename(targetPath) });
    }

    archive.finalize();
  });
}
