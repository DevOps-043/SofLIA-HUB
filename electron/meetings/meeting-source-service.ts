import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DriveService } from '../drive-service';
import { extractDriveFileId, hashMeetingText, normalizeMeetingText } from './meeting-source-utils';
import type { PreparedMeetingSource } from './meeting-types';

interface PrepareManualSourceInput {
  text: string;
  sourceUri?: string | null;
}

interface PrepareDriveSourceInput {
  fileIdOrUrl: string;
}

export class MeetingSourceService {
  constructor(private readonly driveService: DriveService) {}

  async prepareManualSource(input: PrepareManualSourceInput): Promise<PreparedMeetingSource> {
    const normalizedText = normalizeMeetingText(input.text);
    if (!normalizedText) {
      throw new Error('No hay contenido de reunion para procesar.');
    }

    return {
      source_system: 'manual',
      source_type: 'manual_notes',
      source_uri: input.sourceUri ?? null,
      external_file_id: null,
      mime_type: 'text/plain',
      authority_level: 'user_provided',
      normalized_text: normalizedText,
      content_hash: hashMeetingText(normalizedText),
      metadata: {
        imported_at: new Date().toISOString(),
        content_length: normalizedText.length,
      },
    };
  }

  async prepareDriveSource(input: PrepareDriveSourceInput): Promise<PreparedMeetingSource> {
    const fileId = extractDriveFileId(input.fileIdOrUrl);
    if (!fileId) {
      throw new Error('No pude obtener el ID del archivo de Google Drive.');
    }

    const metadataResult = await this.driveService.getFileMetadata(fileId);
    if (!metadataResult.success || !metadataResult.file) {
      throw new Error(metadataResult.error || 'No pude obtener el metadata del archivo de Drive.');
    }

    const tempDir = path.join(app.getPath('userData'), 'meeting-imports');
    await fs.mkdir(tempDir, { recursive: true });

    const safeBaseName = (metadataResult.file.name || fileId).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    const tempPath = path.join(tempDir, `${safeBaseName}_${Date.now()}.txt`);
    const downloadResult = await this.driveService.downloadFile(fileId, tempPath, 'text');
    if (!downloadResult.success) {
      throw new Error(downloadResult.error || 'No pude descargar el archivo de Drive.');
    }

    const rawText = downloadResult.textContent ?? await fs.readFile(downloadResult.path || tempPath, 'utf8');
    const normalizedText = normalizeMeetingText(rawText);
    if (!normalizedText) {
      throw new Error('El archivo de Drive no contiene texto util para procesar.');
    }

    return {
      source_system: 'google_drive',
      source_type: 'drive_file',
      source_uri: metadataResult.file.webViewLink || input.fileIdOrUrl,
      external_file_id: metadataResult.file.id,
      mime_type: metadataResult.file.mimeType,
      authority_level: 'google_workspace',
      normalized_text: normalizedText,
      content_hash: hashMeetingText(normalizedText),
      metadata: {
        imported_at: new Date().toISOString(),
        file_name: metadataResult.file.name,
        web_view_link: metadataResult.file.webViewLink || null,
        size: metadataResult.file.size ?? null,
      },
    };
  }
}
