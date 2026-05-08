import type { CalendarService } from '../calendar-service';
import { getDriveClient } from './google-client';
import { mapDriveFile } from './mappers';
import type { DriveFile, DriveOperationResult } from './types';

export async function createDriveFolder(
  calendarService: CalendarService,
  name: string,
  parentId?: string,
): Promise<DriveOperationResult<{ folderId?: string }>> {
  const drive = await getDriveClient(calendarService);
  if (!drive) return { success: false, error: 'Google no conectado' };

  try {
    const requestBody: any = { name, mimeType: 'application/vnd.google-apps.folder' };
    if (parentId) requestBody.parents = [parentId];
    const response = await drive.files.create({ requestBody, fields: 'id' });
    console.log(`[DriveService] Folder created: ${response.data.id} (${name})`);
    return { success: true, folderId: response.data.id || undefined };
  } catch (err: any) {
    console.error('[DriveService] CreateFolder error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function deleteDriveFile(
  calendarService: CalendarService,
  fileId: string,
): Promise<DriveOperationResult> {
  const drive = await getDriveClient(calendarService);
  if (!drive) return { success: false, error: 'Google no conectado' };

  try {
    await drive.files.delete({ fileId });
    console.log(`[DriveService] File deleted: ${fileId}`);
    return { success: true };
  } catch (err: any) {
    console.error('[DriveService] Delete error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getDriveFileMetadata(
  calendarService: CalendarService,
  fileId: string,
): Promise<DriveOperationResult<{ file: DriveFile }>> {
  const drive = await getDriveClient(calendarService);
  if (!drive) return { success: false, error: 'Google no conectado' };

  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, parents',
    });
    return { success: true, file: mapDriveFile(response.data) };
  } catch (err: any) {
    console.error('[DriveService] GetMetadata error:', err.message);
    return { success: false, error: err.message };
  }
}
