import type { DriveFile } from './types';

export function mapDriveFile(file: any): DriveFile {
  return {
    id: file.id || '',
    name: file.name || '',
    mimeType: file.mimeType || '',
    size: file.size ? parseInt(file.size, 10) : undefined,
    createdTime: file.createdTime || undefined,
    modifiedTime: file.modifiedTime || undefined,
    webViewLink: file.webViewLink || undefined,
    parents: file.parents || undefined,
  };
}
