import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { categorizeFile } from './neural-organizer/categorize-file';
import { extractImageTextIfNeeded } from './neural-organizer/ocr';
import { buildOrganizedFileMessage } from './neural-organizer/notification';
import { moveToCategory } from './neural-organizer/move-file';
import type { NeuralOrganizerOptions } from './neural-organizer/types';
import { waitForFileReady } from './neural-organizer/wait-for-file-ready';
export { NEURAL_ORGANIZER_TOOLS } from './neural-organizer/tools';
export type { NeuralOrganizerOptions } from './neural-organizer/types';
const moduleRequire = createRequire(import.meta.url);
const Tesseract = moduleRequire('tesseract.js');
export class NeuralOrganizerService {
  private watcher: fs.FSWatcher | null = null;
  private isRunning = false;
  private processingFiles = new Set<string>();
  private ai: GoogleGenerativeAI;
  private notifyCallback?: (message: string) => Promise<void>;
  private downloadsPath: string;
  private processedCount = 0;
  constructor(options: NeuralOrganizerOptions) {
    this.ai = new GoogleGenerativeAI(options.apiKey);
    this.notifyCallback = options.notifyCallback;
    this.downloadsPath = path.join(os.homedir(), 'Downloads');
  }
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    if (!fs.existsSync(this.downloadsPath)) {
      fs.mkdirSync(this.downloadsPath, { recursive: true });
    }
    this.watcher = fs.watch(this.downloadsPath, (eventType, filename) => {
      if (eventType === 'rename' && filename) {
        this.handleNewFile(filename).catch((err: Error) => {
          console.error('[NeuralOrganizer] Error handling file:', filename, err.message);
        });
      }
    });
    console.log(`[NeuralOrganizer] Watching for new files in ${this.downloadsPath}`);
  }
  public stop(): void {
    this.watcher?.close();
    this.watcher = null;
    this.isRunning = false;
    this.processingFiles.clear();
    console.log('[NeuralOrganizer] Stopped watching');
  }
  public updateApiKey(apiKey: string): void {
    this.ai = new GoogleGenerativeAI(apiKey);
  }
  public getStatus() {
    return {
      isRunning: this.isRunning,
      downloadsPath: this.downloadsPath,
      processedFilesCount: this.processedCount,
      processingNow: this.processingFiles.size,
    };
  }
  public handleToolCall(toolName: string, args: any): any {
    if (toolName === 'neural_organizer_status') {
      return { success: true, status: this.getStatus() };
    }
    if (toolName === 'neural_organizer_toggle') {
      if (args.enable) {
        this.start();
        return { success: true, message: 'Organizador Neuronal activado. Ahora vigilare la carpeta de descargas.' };
      }
      this.stop();
      return { success: true, message: 'Organizador Neuronal desactivado.' };
    }
    throw new Error(`Tool ${toolName} not supported by NeuralOrganizerService`);
  }
  private async handleNewFile(filename: string): Promise<void> {
    if (filename.endsWith('.crdownload') || filename.endsWith('.tmp') || filename.startsWith('.')) return;
    const filePath = path.join(this.downloadsPath, filename);
    if (this.processingFiles.has(filePath) || !(await waitForFileReady(filePath))) return;
    this.processingFiles.add(filePath);
    try {
      const extractedText = await extractImageTextIfNeeded(Tesseract, filename, filePath);
      const categoryInfo = await categorizeFile(this.ai, filename, extractedText);
      const newFileName = await moveToCategory(filename, filePath, categoryInfo.category);
      this.processedCount++;
      if (this.notifyCallback) {
        await this.notifyCallback(buildOrganizedFileMessage(newFileName, categoryInfo));
      }
    } catch (err: any) {
      console.error(`[NeuralOrganizer] Failed to process ${filename}:`, err.message);
    } finally {
      this.processingFiles.delete(filePath);
    }
  }
}
