import { clipboard } from 'electron';
import { EventEmitter } from 'node:events';
import {
  executeClipboardTool,
  type ClipboardToolInput,
  type ClipboardToolResult,
} from './clipboard-manager/tool';
import type { ClipboardConfig } from './clipboard-manager/types';

export type { ClipboardConfig } from './clipboard-manager/types';
export {
  ClipboardToolSchema,
  clipboardManagerTool,
  type ClipboardToolInput,
} from './clipboard-manager/tool';

export class ClipboardManager extends EventEmitter {
  private history: string[] = [];
  private maxHistorySize: number;
  private pollingIntervalMs: number;
  private intervalId?: NodeJS.Timeout;
  private lastReadText = '';

  constructor(config: ClipboardConfig = {}) {
    super();
    this.maxHistorySize = config.maxHistorySize || 20;
    this.pollingIntervalMs = config.pollingIntervalMs || 1000;
  }

  async init(): Promise<void> {
    try {
      this.lastReadText = await clipboard.readText() || '';
      if (this.lastReadText) this.addToHistory(this.lastReadText);
      console.log('[ClipboardManager] Inicializado correctamente.');
    } catch (error) {
      console.error('[ClipboardManager] Error al inicializar:', error);
    }
  }

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => { void this.checkClipboard(); }, this.pollingIntervalMs);
    console.log('[ClipboardManager] Servicio de monitoreo iniciado.');
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = undefined;
    console.log('[ClipboardManager] Servicio de monitoreo detenido.');
  }

  getStatus() {
    return { active: !!this.intervalId, historyCount: this.history.length, maxHistory: this.maxHistorySize };
  }

  getConfig(): ClipboardConfig {
    return { maxHistorySize: this.maxHistorySize, pollingIntervalMs: this.pollingIntervalMs };
  }

  async writeText(text: string): Promise<void> {
    try {
      await clipboard.writeText(text);
      this.lastReadText = text;
      this.addToHistory(text);
      this.emit('changed', text);
    } catch (error) {
      console.error('[ClipboardManager] Error al escribir en portapapeles:', error);
      throw Object.assign(
        new Error(`No se pudo escribir en el portapapeles: ${(error as Error).message}`),
        { cause: error },
      );
    }
  }

  async readText(): Promise<string> {
    try {
      return await clipboard.readText() || '';
    } catch (error) {
      console.error('[ClipboardManager] Error al leer portapapeles:', error);
      throw Object.assign(
        new Error(`No se pudo leer el portapapeles: ${(error as Error).message}`),
        { cause: error },
      );
    }
  }

  getHistory(): string[] {
    return [...this.history];
  }

  async executeTool(args: ClipboardToolInput): Promise<ClipboardToolResult> {
    return executeClipboardTool(this, args);
  }

  private async checkClipboard(): Promise<void> {
    try {
      const currentText = await clipboard.readText();
      if (!currentText || currentText === this.lastReadText) return;
      this.lastReadText = currentText;
      this.addToHistory(currentText);
      this.emit('changed', currentText);
    } catch {
      // Evita ruido en consola durante polling continuo.
    }
  }

  private addToHistory(text: string): void {
    if (!text?.trim() || this.history[0] === text) return;
    this.history.unshift(text);
    if (this.history.length > this.maxHistorySize) this.history.pop();
  }
}

export const clipboardManagerService = new ClipboardManager();
