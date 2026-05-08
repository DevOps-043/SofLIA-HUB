import { EventEmitter } from 'node:events';
import { clipboard } from 'electron';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
  private genAI: GoogleGenerativeAI | null = null;
  private isRunning = false;

  constructor(config: ClipboardConfig) {
    super();
    this.config = { maxHistorySize: 100, pollingIntervalMs: 5000, ...config };
    if (this.config.apiKey) this.genAI = new GoogleGenerativeAI(this.config.apiKey);
  }

  async init(): Promise<void> {
    this.history = [];
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastCopiedText = readClipboardText(clipboard);
    this.intervalId = setInterval(() => this.pollClipboard(), this.config.pollingIntervalMs || 5000);
    console.log('[ClipboardAIAssistant] Servicio de portapapeles iniciado silenciosamente.');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
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

  updateApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  getHistory(): ClipboardItem[] {
    return this.history;
  }

  async searchClipboardHistory(query: string): Promise<string> {
    return searchClipboardItems(this.history, this.genAI, query);
  }

  private pollClipboard(): void {
    const currentText = readClipboardText(clipboard);
    if (currentText === this.lastCopiedText) return;

    const item = addClipboardText(this.history, currentText, this.config);
    if (!item) return;

    this.lastCopiedText = currentText;
    console.log(`[ClipboardAIAssistant] Nuevo texto copiado: ${formatClipboardLogText(currentText)}`);
    this.emit('new-clipboard-item', item);
  }
}
