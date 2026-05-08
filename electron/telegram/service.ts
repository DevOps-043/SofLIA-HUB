import { EventEmitter } from 'node:events';
import { callTelegramApi, ensureTelegramConfigured } from './api';
import { syncTelegramPolling } from './polling';
import { applyTelegramConfigUpdates, DEFAULT_TELEGRAM_STATE, loadTelegramState, saveTelegramState } from './state';
import { buildTelegramStatus } from './status';
import type { TelegramConfigUpdates, TelegramDeps, TelegramRuntimeContext, TelegramState } from './types';

export class TelegramService extends EventEmitter {
  private state: TelegramState = structuredClone(DEFAULT_TELEGRAM_STATE);
  private deps: TelegramDeps | null = null;
  private polling = false;
  private stopRequested = false;

  async init(deps: TelegramDeps): Promise<void> {
    this.deps = deps;
    this.state = loadTelegramState((state) => saveTelegramState(state));
    await this.syncPollingState();
  }

  async getStatus(): Promise<Record<string, any>> {
    return buildTelegramStatus(this.state, this.polling);
  }

  async updateConfig(updates: TelegramConfigUpdates): Promise<Record<string, any>> {
    applyTelegramConfigUpdates(this.state, updates);
    this.saveState();
    await this.syncPollingState();
    return this.getStatus();
  }

  async testConnection(): Promise<Record<string, any>> {
    ensureTelegramConfigured(this.state);
    const me = await this.callTelegram('getMe', {});
    this.state.botInfo = me.result;
    this.state.lastError = null;
    this.saveState();
    return { success: true, bot: this.state.botInfo };
  }

  async sendMessage(chatId: string, text: string): Promise<Record<string, any>> {
    ensureTelegramConfigured(this.state);
    const response = await this.callTelegram('sendMessage', {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    });
    return { success: true, message: response.result };
  }

  async listRecentChats(): Promise<Record<string, any>> {
    return { success: true, chats: this.state.recentChats.slice(0, 50) };
  }

  private saveState(): void {
    saveTelegramState(this.state);
  }

  private async callTelegram(method: string, payload: Record<string, any>): Promise<any> {
    return callTelegramApi(this.state, method, payload);
  }

  private async syncPollingState(): Promise<void> {
    await syncTelegramPolling(this.buildRuntimeContext());
  }

  private buildRuntimeContext(): TelegramRuntimeContext {
    return {
      state: this.state,
      deps: this.deps,
      callTelegram: (method, payload) => this.callTelegram(method, payload),
      sendMessage: (chatId, text) => this.sendMessage(chatId, text),
      saveState: () => this.saveState(),
      isPolling: () => this.polling,
      setPolling: (polling) => { this.polling = polling; },
      isStopRequested: () => this.stopRequested,
      setStopRequested: (stopRequested) => { this.stopRequested = stopRequested; },
    };
  }
}
