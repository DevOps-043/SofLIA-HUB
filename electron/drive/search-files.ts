import type { CalendarService } from '../calendar-service';
import { listDriveFiles } from './list-files';
import type { DriveFile, DriveOperationResult } from './types';

function escapeDriveQuery(value: string): string {
  return value.replace(/'/g, "\\'");
}

export async function searchDriveFiles(
  calendarService: CalendarService,
  query: string,
): Promise<DriveOperationResult<{ files: DriveFile[] }>> {
  const words = query.split(/\s+/).map(word => word.trim()).filter(word => word.length >= 2);
  if (words.length === 0) {
    return listDriveFiles(calendarService, { maxResults: 20 });
  }

  const strictQuery = words.map(word => `name contains '${escapeDriveQuery(word)}'`).join(' and ');
  const strictResult = await listDriveFiles(calendarService, { query: strictQuery, maxResults: 20 });
  if (strictResult.success && (strictResult.files?.length || 0) > 0) return strictResult;

  const fullTextResult = await listDriveFiles(calendarService, {
    query: `fullText contains '${escapeDriveQuery(query)}'`,
    maxResults: 20,
  });
  if (fullTextResult.success && (fullTextResult.files?.length || 0) > 0) return fullTextResult;

  const allFiles = new Map<string, DriveFile>();
  for (const word of words.slice(0, 3)) {
    const singleResult = await listDriveFiles(calendarService, {
      query: `name contains '${escapeDriveQuery(word)}'`,
      maxResults: 10,
    });
    if (singleResult.success) {
      for (const file of singleResult.files || []) allFiles.set(file.id, file);
    }
  }

  return { success: true, files: Array.from(allFiles.values()).slice(0, 20) };
}
