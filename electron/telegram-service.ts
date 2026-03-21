import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { app } from 'electron';
import type { WorkspaceAutomationService } from './workspace-automation-service';
import type { RemoteNodeService } from './remote-node-service';

interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  pollIntervalMs: number;
  allowedChatIds: string[];
}

interface TelegramRecentChat {
  chatId: string;
  title: string;
  username?: string | null;
  type: string;
  lastMessageAt: string;
  lastMessagePreview: string;
}

interface TelegramBotInfo {
  id: number;
  username?: string;
  first_name?: string;
}

interface TelegramState {
  config: TelegramConfig;
  lastUpdateId: number;
  recentChats: TelegramRecentChat[];
  lastPollAt?: string | null;
  lastError?: string | null;
  botInfo?: TelegramBotInfo | null;
}

interface TelegramDeps {
  workspaceAutomationService: WorkspaceAutomationService;
  remoteNodeService: RemoteNodeService;
}

const DEFAULT_STATE: TelegramState = {
  config: {
    enabled: false,
    botToken: '',
    pollIntervalMs: 8000,
    allowedChatIds: [],
  },
  lastUpdateId: 0,
  recentChats: [],
  lastPollAt: null,
  lastError: null,
  botInfo: null,
};

export class TelegramService extends EventEmitter {
  private state: TelegramState = structuredClone(DEFAULT_STATE);
  private deps: TelegramDeps | null = null;
  private polling = false;
  private stopRequested = false;

  async init(deps: TelegramDeps): Promise<void> {
    this.deps = deps;
    this.loadState();
    await this.syncPollingState();
  }

  async getStatus(): Promise<Record<string, any>> {
    const configured = Boolean(this.state.config.botToken.trim());
    return {
      success: true,
      configured,
      enabled: this.state.config.enabled,
      polling: this.polling,
      poll_interval_ms: this.state.config.pollIntervalMs,
      allowed_chat_ids: [...this.state.config.allowedChatIds],
      last_poll_at: this.state.lastPollAt || null,
      last_error: this.state.lastError || null,
      bot: this.state.botInfo || null,
      recent_chats: this.state.recentChats.slice(0, 20),
      available_agents: [
        { id: 'correo', command: '/correo triage', description: 'Ejecuta triage de Gmail con aprobacion.' },
        { id: 'agenda', command: '/agenda brief', description: 'Genera briefing diario de calendario.' },
        { id: 'ops', command: '/ops status', description: 'Muestra estado del sistema, runs y nodos.' },
      ],
    };
  }

  async updateConfig(updates: Partial<{
    enabled: boolean;
    bot_token: string;
    poll_interval_ms: number;
    allowed_chat_ids: string[];
    reset_offset: boolean;
  }>): Promise<Record<string, any>> {
    if (typeof updates.enabled === 'boolean') {
      this.state.config.enabled = updates.enabled;
    }

    if (typeof updates.bot_token === 'string') {
      this.state.config.botToken = updates.bot_token.trim();
    }

    if (typeof updates.poll_interval_ms === 'number' && Number.isFinite(updates.poll_interval_ms)) {
      this.state.config.pollIntervalMs = Math.max(2000, Math.round(updates.poll_interval_ms));
    }

    if (Array.isArray(updates.allowed_chat_ids)) {
      this.state.config.allowedChatIds = updates.allowed_chat_ids
        .map((item) => String(item || '').trim())
        .filter(Boolean);
    }

    if (updates.reset_offset) {
      this.state.lastUpdateId = 0;
    }

    this.saveState();
    await this.syncPollingState();
    return this.getStatus();
  }

  async testConnection(): Promise<Record<string, any>> {
    this.ensureConfigured();
    const me = await this.callTelegram('getMe', {});
    this.state.botInfo = me.result;
    this.state.lastError = null;
    this.saveState();
    return {
      success: true,
      bot: this.state.botInfo,
    };
  }

  async sendMessage(chatId: string, text: string): Promise<Record<string, any>> {
    this.ensureConfigured();
    const response = await this.callTelegram('sendMessage', {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    });
    return {
      success: true,
      message: response.result,
    };
  }

  async listRecentChats(): Promise<Record<string, any>> {
    return {
      success: true,
      chats: this.state.recentChats.slice(0, 50),
    };
  }

  private getStatePath(): string {
    return path.join(app.getPath('userData'), 'telegram-state.json');
  }

  private loadState(): void {
    try {
      const statePath = this.getStatePath();
      if (!fs.existsSync(statePath)) {
        this.saveState();
        return;
      }

      const parsed = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Partial<TelegramState>;
      this.state = {
        config: {
          enabled: parsed.config?.enabled ?? DEFAULT_STATE.config.enabled,
          botToken: parsed.config?.botToken || '',
          pollIntervalMs: parsed.config?.pollIntervalMs || DEFAULT_STATE.config.pollIntervalMs,
          allowedChatIds: Array.isArray(parsed.config?.allowedChatIds)
            ? parsed.config!.allowedChatIds.map((item) => String(item || '').trim()).filter(Boolean)
            : [],
        },
        lastUpdateId: parsed.lastUpdateId || 0,
        recentChats: Array.isArray(parsed.recentChats) ? parsed.recentChats : [],
        lastPollAt: parsed.lastPollAt || null,
        lastError: parsed.lastError || null,
        botInfo: parsed.botInfo || null,
      };
    } catch (error) {
      console.error('[TelegramService] No se pudo cargar el estado:', error);
      this.state = structuredClone(DEFAULT_STATE);
      this.saveState();
    }
  }

  private saveState(): void {
    const statePath = this.getStatePath();
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  private ensureConfigured(): void {
    if (!this.state.config.botToken.trim()) {
      throw new Error('Configura el bot token de Telegram antes de usar este canal.');
    }
  }

  private async syncPollingState(): Promise<void> {
    if (!this.state.config.enabled || !this.state.config.botToken.trim()) {
      this.stopPolling();
      return;
    }

    await this.testConnection();
    this.startPolling();
  }

  private startPolling(): void {
    if (this.polling) {
      return;
    }

    this.polling = true;
    this.stopRequested = false;
    void this.pollLoop();
  }

  private stopPolling(): void {
    this.stopRequested = true;
    this.polling = false;
  }

  private async pollLoop(): Promise<void> {
    while (!this.stopRequested) {
      try {
        await this.fetchUpdates();
      } catch (error: any) {
        this.state.lastError = error?.message || String(error);
        this.saveState();
      }

      await delay(this.state.config.pollIntervalMs);
    }
  }

  private async fetchUpdates(): Promise<void> {
    this.ensureConfigured();

    const response = await this.callTelegram('getUpdates', {
      offset: this.state.lastUpdateId + 1,
      timeout: 0,
      allowed_updates: ['message'],
    });

    const updates = Array.isArray(response.result) ? response.result : [];
    if (updates.length === 0) {
      this.state.lastPollAt = new Date().toISOString();
      this.saveState();
      return;
    }

    for (const update of updates) {
      const updateId = Number(update.update_id) || 0;
      if (updateId > this.state.lastUpdateId) {
        this.state.lastUpdateId = updateId;
      }

      const message = update.message;
      const chat = message?.chat;
      const text = typeof message?.text === 'string' ? message.text.trim() : '';
      const chatId = String(chat?.id || '');
      if (!chatId || !text) {
        continue;
      }

      this.recordRecentChat(chat, text, message.date);

      if (!this.isChatAllowed(chatId)) {
        continue;
      }

      await this.handleIncomingCommand(chatId, text);
    }

    this.state.lastPollAt = new Date().toISOString();
    this.state.lastError = null;
    this.saveState();
  }

  private isChatAllowed(chatId: string): boolean {
    if (this.state.config.allowedChatIds.length === 0) {
      return true;
    }

    return this.state.config.allowedChatIds.includes(chatId);
  }

  private recordRecentChat(chat: any, text: string, unixTimestamp?: number): void {
    const chatId = String(chat?.id || '');
    if (!chatId) {
      return;
    }

    const title = String(chat?.title || [chat?.first_name, chat?.last_name].filter(Boolean).join(' ') || chat?.username || chatId);
    const username = chat?.username ? String(chat.username) : null;
    const type = String(chat?.type || 'unknown');
    const lastMessageAt = unixTimestamp
      ? new Date(Number(unixTimestamp) * 1000).toISOString()
      : new Date().toISOString();

    const nextRecord: TelegramRecentChat = {
      chatId,
      title,
      username,
      type,
      lastMessageAt,
      lastMessagePreview: text.slice(0, 160),
    };

    this.state.recentChats = [
      nextRecord,
      ...this.state.recentChats.filter((candidate) => candidate.chatId !== chatId),
    ].slice(0, 50);
  }

  private async handleIncomingCommand(chatId: string, text: string): Promise<void> {
    const normalized = text.trim();
    const lowered = normalized.toLowerCase();

    if (lowered === '/start' || lowered === '/help') {
      await this.sendMessage(chatId, this.buildHelpMessage());
      return;
    }

    if (lowered === '/agentes') {
      await this.sendMessage(chatId, [
        'Agentes operativos disponibles:',
        '- correo -> /correo triage [query]',
        '- agenda -> /agenda brief [YYYY-MM-DD]',
        '- ops -> /ops status | /ops runs',
        '- nodes -> /nodes | /node test NODE_ID',
      ].join('\n'));
      return;
    }

    if (lowered === '/status' || lowered === '/ops status') {
      await this.sendMessage(chatId, await this.buildOpsStatusMessage());
      return;
    }

    if (lowered === '/runs' || lowered === '/ops runs') {
      await this.sendMessage(chatId, this.buildRunsMessage());
      return;
    }

    if (lowered.startsWith('/correo triage')) {
      const query = normalized.replace(/^\/correo\s+triage/i, '').trim();
      const run = await this.deps!.workspaceAutomationService.executeTemplate({
        templateId: 'gmail_triage',
        requestedBy: `telegram:${chatId}`,
        input: {
          query: query || 'in:inbox newer_than:7d',
        },
      });
      await this.sendMessage(chatId, this.formatRunMessage(run));
      return;
    }

    if (lowered.startsWith('/agenda brief')) {
      const targetDate = normalized.replace(/^\/agenda\s+brief/i, '').trim();
      const run = await this.deps!.workspaceAutomationService.executeTemplate({
        templateId: 'calendar_daily_brief',
        requestedBy: `telegram:${chatId}`,
        input: {
          targetDate: targetDate || undefined,
        },
      });
      await this.sendMessage(chatId, this.formatRunMessage(run));
      return;
    }

    if (lowered.startsWith('/approve ')) {
      const runId = normalized.replace(/^\/approve\s+/i, '').trim();
      const run = await this.deps!.workspaceAutomationService.approveRun(runId, `telegram:${chatId}`);
      await this.sendMessage(chatId, this.formatRunMessage(run));
      return;
    }

    if (lowered.startsWith('/reject ')) {
      const runId = normalized.replace(/^\/reject\s+/i, '').trim();
      const run = this.deps!.workspaceAutomationService.rejectRun(runId, `telegram:${chatId}`);
      await this.sendMessage(chatId, this.formatRunMessage(run));
      return;
    }

    if (lowered === '/nodes') {
      await this.sendMessage(chatId, await this.buildNodesMessage());
      return;
    }

    if (lowered.startsWith('/node test ')) {
      const nodeId = normalized.replace(/^\/node\s+test\s+/i, '').trim();
      const result = await this.deps!.remoteNodeService.testNode(nodeId);
      await this.sendMessage(chatId, [
        `Nodo ${nodeId}:`,
        `success=${result.success ? 'si' : 'no'}`,
        result.health?.error ? `error=${result.health.error}` : 'health=ok',
      ].join('\n'));
      return;
    }

    await this.sendMessage(chatId, this.buildHelpMessage());
  }

  private async buildOpsStatusMessage(): Promise<string> {
    const status = await this.getStatus();
    const runs = this.deps?.workspaceAutomationService.listRuns(5) || [];
    const pending = runs.filter((run) => run.status === 'needs_approval').length;
    return [
      'Estado operativo SofLIA:',
      `Telegram: ${status.enabled ? 'habilitado' : 'deshabilitado'} / ${status.polling ? 'polling activo' : 'polling detenido'}`,
      `Bot: ${status.bot?.username || status.bot?.first_name || 'sin-bot'}`,
      `Ultimo poll: ${status.last_poll_at || 'n/a'}`,
      `Workflows recientes: ${runs.length}`,
      `Pendientes de aprobacion: ${pending}`,
      `Chats recientes: ${status.recent_chats?.length || 0}`,
    ].join('\n');
  }

  private buildRunsMessage(): string {
    const runs = this.deps?.workspaceAutomationService.listRuns(5) || [];
    if (runs.length === 0) {
      return 'No hay workflows registrados.';
    }

    return [
      'Workflows recientes:',
      ...runs.map((run) => `- ${run.id} | ${run.status} | ${run.title}`),
      '',
      'Comandos:',
      '/approve RUN_ID',
      '/reject RUN_ID',
    ].join('\n');
  }

  private async buildNodesMessage(): Promise<string> {
    const host = await this.deps!.remoteNodeService.getHostStatus();
    const nodes = await this.deps!.remoteNodeService.listNodes();
    return [
      'Estado de nodos:',
      `Host remoto: ${host.running ? 'activo' : 'inactivo'} en ${host.local_url}`,
      `Nodo local: ${host.node_name}`,
      `Nodos registrados: ${nodes.length}`,
      ...nodes.slice(0, 8).map((node) => `- ${node.id} | ${node.name} | ${node.baseUrl} | ${node.lastHealthAt ? 'ok' : 'sin-health'}`),
    ].join('\n');
  }

  private buildHelpMessage(): string {
    return [
      'Comandos disponibles:',
      '/agentes',
      '/ops status',
      '/ops runs',
      '/correo triage [query]',
      '/agenda brief [YYYY-MM-DD]',
      '/approve RUN_ID',
      '/reject RUN_ID',
      '/nodes',
      '/node test NODE_ID',
    ].join('\n');
  }

  private formatRunMessage(run: Record<string, any>): string {
    const actions = Array.isArray(run.actions) ? run.actions : [];
    return [
      `${run.title}`,
      `Run: ${run.id}`,
      `Estado: ${run.status}`,
      `Resumen: ${run.summary || 'Sin resumen.'}`,
      `Acciones: ${actions.length}`,
      ...actions.slice(0, 5).map((action: any) => `- ${action.title} | ${action.status}`),
      run.status === 'needs_approval' ? 'Usa /approve RUN_ID o /reject RUN_ID' : '',
    ].filter(Boolean).join('\n');
  }

  private async callTelegram(method: string, payload: Record<string, any>): Promise<any> {
    const response = await fetch(`https://api.telegram.org/bot${this.state.config.botToken}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const parsed = await response.json();
    if (!response.ok || !parsed?.ok) {
      throw new Error(parsed?.description || `Telegram API devolvio HTTP ${response.status}.`);
    }

    return parsed;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
