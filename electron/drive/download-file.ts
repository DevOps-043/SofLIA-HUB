import fsp from 'node:fs/promises';
import path from 'node:path';
import type { CalendarService } from '../calendar-service';
import { GOOGLE_EXPORT_MAP_PDF, GOOGLE_EXPORT_MAP_TEXT, TEXT_EXPORT_EXTENSIONS } from './export-maps';
import { getDriveClient } from './google-client';
import { writeStreamToFile } from './stream-file';
import type { DriveExportFormat, DriveOperationResult } from './types';

function withExportExtension(destinationPath: string, extension: string): string {
  return destinationPath.endsWith(extension)
    ? destinationPath
    : destinationPath.replace(/\.[^.]+$/, '') + extension;
}

async function readTextPreview(finalPath: string): Promise<string | undefined> {
  if (!TEXT_EXPORT_EXTENSIONS.some(ext => finalPath.endsWith(ext))) return undefined;
  try {
    const content = await fsp.readFile(finalPath, 'utf-8');
    return content.length > 50000
      ? content.slice(0, 50000) + '\n\n[... contenido truncado a 50,000 caracteres ...]'
      : content;
  } catch {
    return undefined;
  }
}

export async function downloadDriveFile(
  calendarService: CalendarService,
  fileId: string,
  destPath: string,
  format: DriveExportFormat = 'text',
): Promise<DriveOperationResult<{ path: string; textContent?: string }>> {
  const drive = await getDriveClient(calendarService);
  if (!drive) return { success: false, error: 'Google no conectado' };

  try {
    await fsp.mkdir(path.dirname(destPath), { recursive: true });
    const meta = await drive.files.get({ fileId, fields: 'mimeType, name' });
    const fileMimeType = meta.data.mimeType || '';
    const exportInfo = (format === 'pdf' ? GOOGLE_EXPORT_MAP_PDF : GOOGLE_EXPORT_MAP_TEXT)[fileMimeType];
    let finalPath = destPath;

    if (exportInfo) {
      finalPath = withExportExtension(finalPath, exportInfo.ext);
      const response = await drive.files.export({ fileId, mimeType: exportInfo.mimeType }, { responseType: 'stream' });
      await writeStreamToFile(response.data, finalPath);
      console.log(`[DriveService] Google Doc exported: ${fileId} -> ${finalPath} (${exportInfo.mimeType})`);
    } else {
      const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
      await writeStreamToFile(response.data, finalPath);
      console.log(`[DriveService] File downloaded: ${fileId} -> ${finalPath}`);
    }

    return { success: true, path: finalPath, textContent: await readTextPreview(finalPath) };
  } catch (err: any) {
    console.error('[DriveService] Download error:', err.message);
    return { success: false, error: err.message };
  }
}
