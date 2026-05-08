import type { CalendarService } from '../calendar-service';
import { getDriveClient } from './google-client';
import { mapDriveFile } from './mappers';
import type { DriveFile, DriveOperationResult } from './types';

export type ListDriveFilesOptions = {
  query?: string;
  folderId?: string;
  maxResults?: number;
  pageToken?: string;
};

export async function listDriveFiles(
  calendarService: CalendarService,
  options?: ListDriveFilesOptions,
): Promise<DriveOperationResult<{ files: DriveFile[]; nextPageToken?: string }>> {
  const drive = await getDriveClient(calendarService);
  if (!drive) return { success: false, error: 'Google no conectado' };

  try {
    let query = options?.query || '';
    if (options?.folderId) {
      const folderFilter = `'${options.folderId}' in parents`;
      query = query ? `${query} and ${folderFilter}` : folderFilter;
    }
    query = query ? `${query} and trashed = false` : 'trashed = false';

    const response = await drive.files.list({
      q: query,
      pageSize: options?.maxResults || 20,
      pageToken: options?.pageToken,
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, parents), nextPageToken',
      orderBy: 'modifiedTime desc',
    });

    return {
      success: true,
      files: (response.data.files || []).map(mapDriveFile),
      nextPageToken: response.data.nextPageToken || undefined,
    };
  } catch (err: any) {
    console.error('[DriveService] ListFiles error:', err.message);
    return { success: false, error: err.message };
  }
}
