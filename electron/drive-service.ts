/**
 * DriveService — Google Drive API integration.
 * Provides file listing, upload, download, and management capabilities.
 * Runs in the Electron main process.
 */
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { CalendarService } from './calendar-service';

// ─── Types ──────────────────────────────────────────────────────────

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
}

// ─── DriveService ───────────────────────────────────────────────────

export class DriveService extends EventEmitter {
  private calendarService: CalendarService;

  constructor(calendarService: CalendarService) {
    super();
    this.calendarService = calendarService;
  }

  // ─── List Files ─────────────────────────────────────────────────

  async listFiles(options?: {
    query?: string;
    folderId?: string;
    maxResults?: number;
    pageToken?: string;
  }): Promise<{ success: boolean; files?: DriveFile[]; nextPageToken?: string; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const drive = google.drive({ version: 'v3', auth });

      let q = options?.query || '';
      if (options?.folderId) {
        const folderFilter = `'${options.folderId}' in parents`;
        q = q ? `${q} and ${folderFilter}` : folderFilter;
      }
      // Exclude trashed files
      q = q ? `${q} and trashed = false` : 'trashed = false';

      const response = await drive.files.list({
        q,
        pageSize: options?.maxResults || 20,
        pageToken: options?.pageToken,
        fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, parents), nextPageToken',
        orderBy: 'modifiedTime desc',
      });

      const files: DriveFile[] = (response.data.files || []).map(f => ({
        id: f.id || '',
        name: f.name || '',
        mimeType: f.mimeType || '',
        size: f.size ? parseInt(f.size, 10) : undefined,
        createdTime: f.createdTime || undefined,
        modifiedTime: f.modifiedTime || undefined,
        webViewLink: f.webViewLink || undefined,
        parents: f.parents || undefined,
      }));

      return { success: true, files, nextPageToken: response.data.nextPageToken || undefined };
    } catch (err: any) {
      console.error('[DriveService] ListFiles error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Search Files ───────────────────────────────────────────────

  async searchFiles(query: string): Promise<{ success: boolean; files?: DriveFile[]; error?: string }> {
    // Split query into individual words and search for each in the file name
    // This way "notas reunión marzo" matches "La reunión se inició ... - Notas de Gemini"
    const words = query
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length >= 2); // ignore single-char words

    if (words.length === 0) {
      return this.listFiles({ maxResults: 20 });
    }

    // Strategy 1: ALL words must appear in filename (strict match)
    const nameConditions = words.map(w => `name contains '${w.replace(/'/g, "\\'")}'`);
    const strictQuery = nameConditions.join(' and ');
    const strictResult = await this.listFiles({ query: strictQuery, maxResults: 20 });

    if (strictResult.success && strictResult.files && strictResult.files.length > 0) {
      return strictResult;
    }

    // Strategy 2: fullText search (searches inside document content too)
    const fullTextQuery = `fullText contains '${query.replace(/'/g, "\\'")}'`;
    const fullTextResult = await this.listFiles({ query: fullTextQuery, maxResults: 20 });

    if (fullTextResult.success && fullTextResult.files && fullTextResult.files.length > 0) {
      return fullTextResult;
    }

    // Strategy 3: Relax — try each word individually and merge results
    const allFiles = new Map<string, DriveFile>();
    for (const word of words.slice(0, 3)) { // max 3 individual searches
      const singleResult = await this.listFiles({
        query: `name contains '${word.replace(/'/g, "\\'")}'`,
        maxResults: 10,
      });
      if (singleResult.success && singleResult.files) {
        for (const f of singleResult.files) {
          allFiles.set(f.id, f);
        }
      }
    }

    if (allFiles.size > 0) {
      return { success: true, files: Array.from(allFiles.values()).slice(0, 20) };
    }

    return { success: true, files: [] };
  }

  // ─── Upload File ────────────────────────────────────────────────

  async uploadFile(
    localPath: string,
    options?: { name?: string; folderId?: string; mimeType?: string },
  ): Promise<{ success: boolean; file?: DriveFile; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      // Verify file exists
      await fsp.access(localPath);

      const { google } = await import('googleapis');
      const drive = google.drive({ version: 'v3', auth });

      const fileName = options?.name || path.basename(localPath);
      const requestBody: any = { name: fileName };
      if (options?.folderId) requestBody.parents = [options.folderId];

      const media: any = {
        body: fs.createReadStream(localPath),
      };
      if (options?.mimeType) media.mimeType = options.mimeType;

      const response = await drive.files.create({
        requestBody,
        media,
        fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, parents',
      });

      const file: DriveFile = {
        id: response.data.id || '',
        name: response.data.name || '',
        mimeType: response.data.mimeType || '',
        size: response.data.size ? parseInt(response.data.size, 10) : undefined,
        createdTime: response.data.createdTime || undefined,
        modifiedTime: response.data.modifiedTime || undefined,
        webViewLink: response.data.webViewLink || undefined,
        parents: response.data.parents || undefined,
      };

      console.log(`[DriveService] File uploaded: ${file.id} (${file.name})`);
      return { success: true, file };
    } catch (err: any) {
      console.error('[DriveService] Upload error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Download File ──────────────────────────────────────────────

  // Google Docs native MIME types → export format mapping
  // Default: text/plain for Docs so the agent can read content directly
  // PDF map used when the caller needs a file to send (e.g., whatsapp_send_file)
  private static GOOGLE_EXPORT_MAP_TEXT: Record<string, { mimeType: string; ext: string }> = {
    'application/vnd.google-apps.document': { mimeType: 'text/plain', ext: '.txt' },
    'application/vnd.google-apps.spreadsheet': { mimeType: 'text/csv', ext: '.csv' },
    'application/vnd.google-apps.presentation': { mimeType: 'text/plain', ext: '.txt' },
    'application/vnd.google-apps.drawing': { mimeType: 'image/png', ext: '.png' },
  };

  static GOOGLE_EXPORT_MAP_PDF: Record<string, { mimeType: string; ext: string }> = {
    'application/vnd.google-apps.document': { mimeType: 'application/pdf', ext: '.pdf' },
    'application/vnd.google-apps.spreadsheet': { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: '.xlsx' },
    'application/vnd.google-apps.presentation': { mimeType: 'application/pdf', ext: '.pdf' },
    'application/vnd.google-apps.drawing': { mimeType: 'image/png', ext: '.png' },
  };

  async downloadFile(
    fileId: string,
    destPath: string,
    format: 'text' | 'pdf' = 'text',
  ): Promise<{ success: boolean; path?: string; textContent?: string; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const drive = google.drive({ version: 'v3', auth });

      // Ensure destination directory exists
      await fsp.mkdir(path.dirname(destPath), { recursive: true });

      // First get file metadata to check if it's a Google Docs native type
      const meta = await drive.files.get({ fileId, fields: 'mimeType, name' });
      const fileMimeType = meta.data.mimeType || '';
      const exportMap = format === 'pdf' ? DriveService.GOOGLE_EXPORT_MAP_PDF : DriveService.GOOGLE_EXPORT_MAP_TEXT;
      const exportInfo = exportMap[fileMimeType];

      let finalPath = destPath;

      if (exportInfo) {
        // Google Docs/Sheets/Slides → export to a real format
        // Append correct extension if not already present
        if (!finalPath.endsWith(exportInfo.ext)) {
          finalPath = finalPath.replace(/\.[^.]+$/, '') + exportInfo.ext;
        }

        const response = await drive.files.export(
          { fileId, mimeType: exportInfo.mimeType },
          { responseType: 'stream' },
        );

        const dest = fs.createWriteStream(finalPath);
        await new Promise<void>((resolve, reject) => {
          (response.data as any)
            .on('end', resolve)
            .on('error', reject)
            .pipe(dest);
        });

        console.log(`[DriveService] Google Doc exported: ${fileId} → ${finalPath} (${exportInfo.mimeType})`);
      } else {
        // Regular binary file → direct download
        const response = await drive.files.get(
          { fileId, alt: 'media' },
          { responseType: 'stream' },
        );

        const dest = fs.createWriteStream(finalPath);
        await new Promise<void>((resolve, reject) => {
          (response.data as any)
            .on('end', resolve)
            .on('error', reject)
            .pipe(dest);
        });

        console.log(`[DriveService] File downloaded: ${fileId} → ${finalPath}`);
      }

      // If the file is a text-based format, read and return the content
      let textContent: string | undefined;
      const textExts = ['.txt', '.csv', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts'];
      if (textExts.some(ext => finalPath.endsWith(ext))) {
        try {
          textContent = await fsp.readFile(finalPath, 'utf-8');
          // Trim to avoid huge payloads (max ~50KB for WhatsApp agent context)
          if (textContent.length > 50000) {
            textContent = textContent.slice(0, 50000) + '\n\n[... contenido truncado a 50,000 caracteres ...]';
          }
        } catch { /* ignore read errors for binary files */ }
      }

      return { success: true, path: finalPath, textContent };
    } catch (err: any) {
      console.error('[DriveService] Download error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Create Folder ──────────────────────────────────────────────

  async createFolder(
    name: string,
    parentId?: string,
  ): Promise<{ success: boolean; folderId?: string; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const drive = google.drive({ version: 'v3', auth });

      const requestBody: any = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
      };
      if (parentId) requestBody.parents = [parentId];

      const response = await drive.files.create({
        requestBody,
        fields: 'id',
      });

      console.log(`[DriveService] Folder created: ${response.data.id} (${name})`);
      return { success: true, folderId: response.data.id || undefined };
    } catch (err: any) {
      console.error('[DriveService] CreateFolder error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Delete File ────────────────────────────────────────────────

  async deleteFile(fileId: string): Promise<{ success: boolean; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const drive = google.drive({ version: 'v3', auth });

      await drive.files.delete({ fileId });

      console.log(`[DriveService] File deleted: ${fileId}`);
      return { success: true };
    } catch (err: any) {
      console.error('[DriveService] Delete error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Get File Metadata ──────────────────────────────────────────

  async getFileMetadata(fileId: string): Promise<{ success: boolean; file?: DriveFile; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const drive = google.drive({ version: 'v3', auth });

      const response = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, parents',
      });

      const file: DriveFile = {
        id: response.data.id || '',
        name: response.data.name || '',
        mimeType: response.data.mimeType || '',
        size: response.data.size ? parseInt(response.data.size, 10) : undefined,
        createdTime: response.data.createdTime || undefined,
        modifiedTime: response.data.modifiedTime || undefined,
        webViewLink: response.data.webViewLink || undefined,
        parents: response.data.parents || undefined,
      };

      return { success: true, file };
    } catch (err: any) {
      console.error('[DriveService] GetMetadata error:', err.message);
      return { success: false, error: err.message };
    }
  }
}
