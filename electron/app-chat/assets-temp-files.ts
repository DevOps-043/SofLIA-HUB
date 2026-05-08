import { app } from 'electron';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { sanitizeFileName } from './text-utils';

export async function writeImageDataToTempFile(fileName: string, imageData: string): Promise<string> {
  const tempDir = app.getPath('temp');
  const safeFileName = sanitizeFileName(fileName);
  const tempPath = path.join(tempDir, `soflia_app_chat_${Date.now()}_${safeFileName}`);

  if (imageData.startsWith('data:')) {
    const base64 = imageData.replace(/^data:[^;]+;base64,/i, '');
    await fsp.writeFile(tempPath, Buffer.from(base64, 'base64'));
    return tempPath;
  }

  if (path.isAbsolute(imageData) && fs.existsSync(imageData)) {
    return imageData;
  }

  throw new Error('Ese asset no tiene una imagen exportable disponible.');
}
