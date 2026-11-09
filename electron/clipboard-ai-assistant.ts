import { EventEmitter } from 'node:events';
import { clipboard } from 'electron';
import { onAuthStateChange, isAuthenticated } from './main/auth-state';
import {
  addClipboardText,
  formatClipboardLogText,
  readClipboardText,
} from './clipboard-ai-assistant/history';
import { searchClipboardItems } from './clipboard-ai-assistant/search';
import type {
  ClipboardConfig,
  ClipboardItem,
  ClipboardStatus,
} from './clipboard-ai-assistant/types';

export type {
  ClipboardConfig,
  ClipboardItem,
  ClipboardStatus,
} from './clipboard-ai-assistant/types';
export {
  handleSearchClipboardTool,
  searchClipboardToolDeclaration,
} from './clipboard-ai-assistant/tools';

export class ClipboardAIAssistant extends EventEmitter {
  private config: ClipboardConfig;
  private intervalId?: NodeJS.Timeout;
  private history: ClipboardItem[] = [];
  private lastCopiedText = '';
  private isRunning = false;
  private revision = 0;
  private removeAuthListener?: () => void;

  constructor(config: ClipboardConfig) {
    super();
    this.config = { maxHistorySize: 100, pollingIntervalMs: 5000, ...config };
  }

  async init(): Promise<void> {
    this.history = [];
    this.removeAuthListener?.();
    this.removeAuthListener = onAuthStateChange(({ authenticated }) => {
      this.resetCapture();
      if (authenticated) void this.start();
    });
  }

  async start(): Promise<void> {
    if (this.isRunning || !isAuthenticated()) return;
    const revision = this.revision;
    this.isRunning = true;
    const initial = await readClipboardText(clipboard);
    if (revision !== this.revision) return;
    this.lastCopiedText = initial;
    this.intervalId = setInterval(() => { void this.pollClipboard(); }, this.config.pollingIntervalMs || 5000);
    console.log('[ClipboardAIAssistant] Servicio de portapapeles iniciado silenciosamente.');
  }

  async stop(): Promise<void> {
    this.removeAuthListener?.();
    this.removeAuthListener = undefined;
    this.resetCapture();
  }

  private resetCapture(): void {
    this.revision++;
    this.isRunning = false;
    this.history = [];
    this.lastCopiedText = '';
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    console.log('[ClipboardAIAssistant] Servicio de portapapeles detenido.');
  }

  getStatus(): ClipboardStatus {
    return { isRunning: this.isRunning, historyCount: this.history.length };
  }

  getConfig(): ClipboardConfig {
    return this.config;
  }

  getHistory(): ClipboardItem[] {
    return this.history;
  }

  async searchClipboardHistory(query: string): Promise<string> {
    return searchClipboardItems(this.history, query);
  }

  private async pollClipboard(): Promise<void> {
    const revision = this.revision;
    const currentText = await readClipboardText(clipboard);
    if (!this.isRunning || revision !== this.revision) return;
    if (currentText === this.lastCopiedText) return;

    const item = addClipboardText(this.history, currentText, this.config);
    if (!item) return;

    this.lastCopiedText = currentText;
    console.log(`[ClipboardAIAssistant] Nuevo texto copiado: ${formatClipboardLogText(currentText)}`);
    this.emit('new-clipboard-item', item);
  }
}
