import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { CalendarService } from '../calendar-service';
import { getDriveClient } from './google-client';
import { mapDriveFile } from './mappers';
import type { DriveFile, DriveOperationResult } from './types';

export type UploadDriveFileOptions = {
  name?: string;
  folderId?: string;
  mimeType?: string;
};

export async function uploadDriveFile(
  calendarService: CalendarService,
  localPath: string,
  options?: UploadDriveFileOptions,
): Promise<DriveOperationResult<{ file: DriveFile }>> {
  const drive = await getDriveClient(calendarService);
  if (!drive) return { success: false, error: 'Google no conectado' };

  try {
    await fsp.access(localPath);
    const requestBody: any = { name: options?.name || path.basename(localPath) };
    if (options?.folderId) requestBody.parents = [options.folderId];

    const media: any = { body: fs.createReadStream(localPath) };
    if (options?.mimeType) media.mimeType = options.mimeType;

    const response = await drive.files.create({
      requestBody,
      media,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, parents',
    });

    const file = mapDriveFile(response.data);
    console.log(`[DriveService] File uploaded: ${file.id} (${file.name})`);
    return { success: true, file };
  } catch (err: any) {
    console.error('[DriveService] Upload error:', err.message);
    return { success: false, error: err.message };
  }
}
