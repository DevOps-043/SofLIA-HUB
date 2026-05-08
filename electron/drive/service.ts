import { EventEmitter } from 'node:events';
import type { CalendarService } from '../calendar-service';
import { GOOGLE_EXPORT_MAP_PDF, GOOGLE_EXPORT_MAP_TEXT } from './export-maps';
import { downloadDriveFile } from './download-file';
import { createDriveFolder, deleteDriveFile, getDriveFileMetadata } from './file-operations';
import { listDriveFiles, type ListDriveFilesOptions } from './list-files';
import { searchDriveFiles } from './search-files';
import { uploadDriveFile, type UploadDriveFileOptions } from './upload-file';

export class DriveService extends EventEmitter {
  private calendarService: CalendarService;

  static GOOGLE_EXPORT_MAP_TEXT = GOOGLE_EXPORT_MAP_TEXT;

  static GOOGLE_EXPORT_MAP_PDF = GOOGLE_EXPORT_MAP_PDF;

  constructor(calendarService: CalendarService) {
    super();
    this.calendarService = calendarService;
  }

  async listFiles(options?: ListDriveFilesOptions) {
    return listDriveFiles(this.calendarService, options);
  }

  async searchFiles(query: string) {
    return searchDriveFiles(this.calendarService, query);
  }

  async uploadFile(localPath: string, options?: UploadDriveFileOptions) {
    return uploadDriveFile(this.calendarService, localPath, options);
  }

  async downloadFile(fileId: string, destPath: string, format: 'text' | 'pdf' = 'text') {
    return downloadDriveFile(this.calendarService, fileId, destPath, format);
  }

  async createFolder(name: string, parentId?: string) {
    return createDriveFolder(this.calendarService, name, parentId);
  }

  async deleteFile(fileId: string) {
    return deleteDriveFile(this.calendarService, fileId);
  }

  async getFileMetadata(fileId: string) {
    return getDriveFileMetadata(this.calendarService, fileId);
  }
}
