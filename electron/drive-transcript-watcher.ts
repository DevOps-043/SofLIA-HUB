/**
 * DriveTranscriptWatcher — Auto-detection of transcriptions in Google Drive
 *
 * Polls monitored Drive folders for new transcript files from:
 *  - Google Meet (Gemini auto-transcripts as Google Docs)
 *  - Plaud Note (physical transcriber → .txt/.docx/.pdf uploads)
 *  - Manual uploads to "SofLIA Transcripts" folder
 *
 * When a new transcript is detected:
 *  1. Downloads and extracts text content
 *  2. Auto-triggers the meeting_followup workflow
 *  3. Notifies the owner via WhatsApp + UI
 *
 * Follows the project's no-webhooks policy: uses setInterval polling (2 min).
 */
import { EventEmitter } from 'node:events';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { DriveService, DriveFile } from './drive-service';
import type { WorkflowEngine } from './workflow-engine';
import type { WhatsAppService } from './whatsapp-service';
import type { CalendarService } from './calendar-service';

// ─── Types ──────────────────────────────────────────────────────────

export interface TranscriptWatcherConfig {
  enabled: boolean;
  pollIntervalMinutes: number;
  watchedFolderIds: string[];
  watchedFolderName: string;
  autoCreateFolder: boolean;
  namePatterns: string[];
  autoTriggerWorkflow: boolean;
  notifyViaWhatsApp: boolean;
  defaultOwnerId: string | null;
  defaultOwnerPhone: string | null;
}

interface ProcessedFile {
  processedAt: string;
  runId: string | null;
  source: 'meet' | 'plaud' | 'manual' | 'unknown';
  fileName: string;
}

type ProcessedRegistry = Record<string, ProcessedFile>;

interface DetectedTranscript {
  file: DriveFile;
  source: 'meet' | 'plaud' | 'manual' | 'unknown';
  textContent: string;
}

// ─── Default Config ─────────────────────────────────────────────────

const DEFAULT_CONFIG: TranscriptWatcherConfig = {
  enabled: true,
  pollIntervalMinutes: 2,
  watchedFolderIds: [],
  watchedFolderName: 'SofLIA Transcripts',
  autoCreateFolder: true,
  namePatterns: [
    'transcript',
    'transcripci[oó]n',
    'transcription',
    'plaud',
    'PLAUD',
    'recording',
    'grabaci[oó]n',
    'nota de voz',
    'reuni[oó]n',
    'meeting notes',
    'acta de reuni[oó]n',
  ],
  autoTriggerWorkflow: true,
  notifyViaWhatsApp: true,
  defaultOwnerId: null,
  defaultOwnerPhone: null,
};

// ─── Source Detection Patterns ──────────────────────────────────────

const SOURCE_PATTERNS: { source: 'meet' | 'plaud'; patterns: RegExp[] }[] = [
  {
    source: 'meet',
    patterns: [
      /transcript/i,
      /transcripci[oó]n/i,
      /meeting\s*notes/i,
      /google\s*meet/i,
    ],
  },
  {
    source: 'plaud',
    patterns: [
      /plaud/i,
      /PLAUD/,
      /recording/i,
      /grabaci[oó]n/i,
      /nota\s*de\s*voz/i,
    ],
  },
];

// MIME types we can extract text from
const SUPPORTED_MIME_TYPES = new Set([
  'application/vnd.google-apps.document',   // Google Docs → export as text/plain
  'text/plain',                              // .txt files
  'application/pdf',                         // PDFs → Gemini extraction (future)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/markdown',                           // .md files
  'text/csv',                                // CSV notes
]);

// ─── File Paths ─────────────────────────────────────────────────────

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'transcript-watcher-config.json');
}

function getProcessedPath(): string {
  return path.join(app.getPath('userData'), 'transcript-watcher-processed.json');
}

// ─── DriveTranscriptWatcher ─────────────────────────────────────────

export class DriveTranscriptWatcher extends EventEmitter {
  private driveService: DriveService;
  private calendarService: CalendarService;
  private workflowEngine: WorkflowEngine;
  private waService: WhatsAppService | null;

  private config: TranscriptWatcherConfig = { ...DEFAULT_CONFIG };
  private processed: ProcessedRegistry = {};
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;
  private lastPollTime: string | null = null;

  constructor(
    driveService: DriveService,
    calendarService: CalendarService,
    workflowEngine: WorkflowEngine,
    waService: WhatsAppService | null,
  ) {
    super();
    this.driveService = driveService;
    this.calendarService = calendarService;
    this.workflowEngine = workflowEngine;
    this.waService = waService;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────

  async init(): Promise<void> {
    await this.loadConfig();
    await this.loadProcessed();
    console.log(`[TranscriptWatcher] Initialized — enabled=${this.config.enabled}, folders=${this.config.watchedFolderIds.length}`);
  }

  start(): void {
    if (this.pollTimer) return;
    if (!this.config.enabled) {
      console.log('[TranscriptWatcher] Disabled by config — not starting');
      return;
    }

    const intervalMs = this.config.pollIntervalMinutes * 60 * 1000;
    this.pollTimer = setInterval(() => this.poll(), intervalMs);
    console.log(`[TranscriptWatcher] Polling started — every ${this.config.pollIntervalMinutes}min`);

    // Run initial poll after a short delay (let Drive API warm up)
    setTimeout(() => this.poll(), 10_000);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      console.log('[TranscriptWatcher] Polling stopped');
    }
  }

  isRunning(): boolean {
    return this.pollTimer !== null;
  }

  // ─── Config Management ────────────────────────────────────────────

  getConfig(): TranscriptWatcherConfig {
    return { ...this.config };
  }

  async updateConfig(updates: Partial<TranscriptWatcherConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();

    // Restart polling if interval changed
    if (updates.pollIntervalMinutes !== undefined && this.pollTimer) {
      this.stop();
      this.start();
    }

    // Stop if disabled
    if (updates.enabled === false) {
      this.stop();
    } else if (updates.enabled === true && !this.pollTimer) {
      this.start();
    }

    console.log('[TranscriptWatcher] Config updated');
  }

  getProcessedFiles(): ProcessedRegistry {
    return { ...this.processed };
  }

  // ─── Core Polling Logic ───────────────────────────────────────────

  async poll(): Promise<{ found: number; processed: number; errors: string[] }> {
    if (this.isPolling) {
      return { found: 0, processed: 0, errors: ['Poll already in progress'] };
    }

    this.isPolling = true;
    const errors: string[] = [];
    let found = 0;
    let processedCount = 0;

    try {
      // Ensure we have a monitored folder
      await this.ensureWatchedFolder();

      if (this.config.watchedFolderIds.length === 0) {
        console.log('[TranscriptWatcher] No watched folders — skipping poll');
        return { found: 0, processed: 0, errors: [] };
      }

      // Poll each watched folder
      for (const folderId of this.config.watchedFolderIds) {
        try {
          const newFiles = await this.findNewFiles(folderId);
          found += newFiles.length;

          for (const file of newFiles) {
            try {
              const transcript = await this.processFile(file);
              if (transcript) {
                await this.handleDetectedTranscript(transcript);
                processedCount++;
              }
            } catch (err: any) {
              const errMsg = `Error processing ${file.name}: ${err.message}`;
              console.error(`[TranscriptWatcher] ${errMsg}`);
              errors.push(errMsg);
            }
          }
        } catch (err: any) {
          const errMsg = `Error scanning folder ${folderId}: ${err.message}`;
          console.error(`[TranscriptWatcher] ${errMsg}`);
          errors.push(errMsg);
        }
      }

      this.lastPollTime = new Date().toISOString();

      if (found > 0) {
        console.log(`[TranscriptWatcher] Poll complete: found=${found}, processed=${processedCount}, errors=${errors.length}`);
      }
    } catch (err: any) {
      console.error('[TranscriptWatcher] Poll error:', err.message);
      errors.push(err.message);
    } finally {
      this.isPolling = false;
    }

    this.emit('poll-complete', { found, processed: processedCount, errors });
    return { found, processed: processedCount, errors };
  }

  // ─── Find New Files in a Folder ───────────────────────────────────

  private async findNewFiles(folderId: string): Promise<DriveFile[]> {
    // Build query: files in this folder, modified recently, not trashed
    let timeFilter = '';
    if (this.lastPollTime) {
      timeFilter = ` and modifiedTime > '${this.lastPollTime}'`;
    }

    const result = await this.driveService.listFiles({
      folderId,
      query: `mimeType != 'application/vnd.google-apps.folder'${timeFilter}`,
      maxResults: 50,
    });

    if (!result.success || !result.files) return [];

    // Filter: not already processed + supported MIME type + matches name patterns
    return result.files.filter(f => {
      if (this.processed[f.id]) return false;
      if (!this.isSupportedFile(f)) return false;
      return true;
    });
  }

  private isSupportedFile(file: DriveFile): boolean {
    // Check MIME type
    if (!SUPPORTED_MIME_TYPES.has(file.mimeType)) return false;

    // Check name patterns (any pattern match = accept)
    const namePatterns = this.config.namePatterns.map(p => new RegExp(p, 'i'));
    const nameMatches = namePatterns.some(rx => rx.test(file.name));

    // Files in the dedicated folder are always accepted regardless of name
    // (we only apply name filter for files discovered through broader search)
    return nameMatches || true; // In watched folder = always accept
  }

  // ─── Process a Detected File ──────────────────────────────────────

  private async processFile(file: DriveFile): Promise<DetectedTranscript | null> {
    console.log(`[TranscriptWatcher] Processing: "${file.name}" (${file.mimeType})`);

    const source = this.classifySource(file);
    let textContent: string;

    try {
      textContent = await this.extractText(file);
    } catch (err: any) {
      console.error(`[TranscriptWatcher] Text extraction failed for "${file.name}":`, err.message);
      // Mark as processed to avoid retrying endlessly
      await this.markProcessed(file.id, null, source, file.name);
      return null;
    }

    if (!textContent || textContent.trim().length < 50) {
      console.log(`[TranscriptWatcher] Skipping "${file.name}" — text too short (${textContent?.length || 0} chars)`);
      await this.markProcessed(file.id, null, source, file.name);
      return null;
    }

    return { file, source, textContent };
  }

  // ─── Text Extraction by MIME Type ─────────────────────────────────

  private async extractText(file: DriveFile): Promise<string> {
    switch (file.mimeType) {
      case 'application/vnd.google-apps.document':
        return this.exportGoogleDocAsText(file.id);

      case 'text/plain':
      case 'text/markdown':
      case 'text/csv':
        return this.downloadAsText(file.id);

      case 'application/pdf':
        // For PDFs, download and attempt basic text extraction
        // (Full Gemini-based extraction can be added later)
        return this.downloadAsText(file.id);

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        // For .docx, download the raw binary and do basic text extraction
        return this.downloadAsText(file.id);

      default:
        throw new Error(`Unsupported MIME type: ${file.mimeType}`);
    }
  }

  /**
   * Export a Google Doc as plain text via Drive API.
   * This is the primary method for Meet transcripts (which are Google Docs).
   */
  private async exportGoogleDocAsText(fileId: string): Promise<string> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) throw new Error('Google not connected');

    const { google } = await import('googleapis');
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.export({
      fileId,
      mimeType: 'text/plain',
    });

    // response.data is the text content
    const text = typeof response.data === 'string'
      ? response.data
      : String(response.data);

    console.log(`[TranscriptWatcher] Google Doc exported as text: ${text.length} chars`);
    return text;
  }

  /**
   * Download a binary file and read as UTF-8 text.
   * Works for .txt, .md, and basic text files.
   */
  private async downloadAsText(fileId: string): Promise<string> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) throw new Error('Google not connected');

    const { google } = await import('googleapis');
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'text' },
    );

    return typeof response.data === 'string'
      ? response.data
      : String(response.data);
  }

  // ─── Source Classification ────────────────────────────────────────

  private classifySource(file: DriveFile): 'meet' | 'plaud' | 'manual' | 'unknown' {
    // Check file name against source patterns
    for (const { source, patterns } of SOURCE_PATTERNS) {
      if (patterns.some(rx => rx.test(file.name))) {
        return source;
      }
    }

    // Google Docs in the transcript folder are likely Meet transcripts
    if (file.mimeType === 'application/vnd.google-apps.document') {
      return 'meet';
    }

    return 'manual';
  }

  // ─── Handle Detected Transcript ───────────────────────────────────

  private async handleDetectedTranscript(transcript: DetectedTranscript): Promise<void> {
    const { file, source, textContent } = transcript;
    let runId: string | null = null;

    console.log(`[TranscriptWatcher] New transcript: "${file.name}" source=${source} (${textContent.length} chars)`);

    // Auto-trigger workflow if enabled
    if (this.config.autoTriggerWorkflow) {
      try {
        const run = await this.workflowEngine.startRun({
          definitionSlug: 'meeting_followup',
          triggeredBy: this.config.defaultOwnerId || 'system',
          triggerType: `drive_${source}`,
          triggerRef: file.id,
          initialContext: {
            raw_input: textContent,
            source_type: source,
            file_id: file.id,
            file_name: file.name,
            file_mime_type: file.mimeType,
            file_web_link: file.webViewLink || null,
            detected_at: new Date().toISOString(),
          },
        });

        runId = run?.run_id ?? null;
        console.log(`[TranscriptWatcher] Workflow started: runId=${runId}`);

        this.emit('workflow-triggered', {
          fileId: file.id,
          fileName: file.name,
          source,
          runId,
        });
      } catch (err: any) {
        console.error(`[TranscriptWatcher] Workflow trigger failed:`, err.message);
      }
    }

    // Notify via WhatsApp
    if (this.config.notifyViaWhatsApp && this.config.defaultOwnerPhone && this.waService) {
      try {
        const status = this.waService.getStatus();
        if (status.connected) {
          const sourceLabel =
            source === 'meet' ? 'Google Meet' :
            source === 'plaud' ? 'Plaud Note' :
            source === 'manual' ? 'subida manual' : 'fuente desconocida';

          const message =
            `📝 *Nueva transcripción detectada*\n\n` +
            `Archivo: ${file.name}\n` +
            `Fuente: ${sourceLabel}\n` +
            `Tamaño: ${textContent.length} caracteres\n` +
            (runId
              ? `\nWorkflow iniciado automáticamente. Revisa las aprobaciones en SofLIA Hub.`
              : `\nNo se inició workflow automático. Puedes revisarla manualmente.`);

          const jid = `${this.config.defaultOwnerPhone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
          await this.waService.sendText(jid, message);
        }
      } catch (err: any) {
        console.error('[TranscriptWatcher] WhatsApp notify failed:', err.message);
      }
    }

    // Notify UI
    this.emit('transcript-detected', {
      fileId: file.id,
      fileName: file.name,
      source,
      runId,
      textLength: textContent.length,
    });

    // Mark as processed
    await this.markProcessed(file.id, runId, source, file.name);
  }

  // ─── Watched Folder Management ────────────────────────────────────

  private async ensureWatchedFolder(): Promise<void> {
    if (this.config.watchedFolderIds.length > 0) return;
    if (!this.config.autoCreateFolder) return;

    // Search for existing folder
    const searchResult = await this.driveService.listFiles({
      query: `name = '${this.config.watchedFolderName}' and mimeType = 'application/vnd.google-apps.folder'`,
      maxResults: 1,
    });

    if (searchResult.success && searchResult.files && searchResult.files.length > 0) {
      const folder = searchResult.files[0];
      this.config.watchedFolderIds = [folder.id];
      await this.saveConfig();
      console.log(`[TranscriptWatcher] Found existing folder: "${this.config.watchedFolderName}" (${folder.id})`);
      return;
    }

    // Create folder
    const createResult = await this.driveService.createFolder(this.config.watchedFolderName);
    if (createResult.success && createResult.folderId) {
      this.config.watchedFolderIds = [createResult.folderId];
      await this.saveConfig();
      console.log(`[TranscriptWatcher] Created folder: "${this.config.watchedFolderName}" (${createResult.folderId})`);
    }
  }

  // ─── Persistence ──────────────────────────────────────────────────

  private async loadConfig(): Promise<void> {
    try {
      const raw = await fsp.readFile(getConfigPath(), 'utf-8');
      const saved = JSON.parse(raw);
      this.config = { ...DEFAULT_CONFIG, ...saved };
    } catch {
      // First run — use defaults
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await fsp.writeFile(getConfigPath(), JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err: any) {
      console.error('[TranscriptWatcher] Failed to save config:', err.message);
    }
  }

  private async loadProcessed(): Promise<void> {
    try {
      const raw = await fsp.readFile(getProcessedPath(), 'utf-8');
      this.processed = JSON.parse(raw);
    } catch {
      this.processed = {};
    }
  }

  private async markProcessed(
    fileId: string,
    runId: string | null,
    source: 'meet' | 'plaud' | 'manual' | 'unknown',
    fileName: string,
  ): Promise<void> {
    this.processed[fileId] = {
      processedAt: new Date().toISOString(),
      runId,
      source,
      fileName,
    };
    try {
      await fsp.writeFile(getProcessedPath(), JSON.stringify(this.processed, null, 2), 'utf-8');
    } catch (err: any) {
      console.error('[TranscriptWatcher] Failed to save processed registry:', err.message);
    }
  }

  // ─── Force Scan (triggered from UI or WhatsApp) ───────────────────

  async forceScan(): Promise<{ found: number; processed: number; errors: string[] }> {
    console.log('[TranscriptWatcher] Force scan triggered');
    // Temporarily clear lastPollTime to scan all files
    const saved = this.lastPollTime;
    this.lastPollTime = null;
    const result = await this.poll();
    // Restore (poll() already set lastPollTime to now)
    if (result.found === 0 && saved) {
      this.lastPollTime = saved;
    }
    return result;
  }

  // ─── Status ───────────────────────────────────────────────────────

  getStatus(): {
    running: boolean;
    config: TranscriptWatcherConfig;
    lastPollTime: string | null;
    processedCount: number;
  } {
    return {
      running: this.isRunning(),
      config: this.getConfig(),
      lastPollTime: this.lastPollTime,
      processedCount: Object.keys(this.processed).length,
    };
  }
}
