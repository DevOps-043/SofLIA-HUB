import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import makeWASocket, {
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';
import { AUTH_DIR, loadConfig, saveConfig } from './config';
import { registerConnectionEvents } from './connection-events';
import { logger } from './logger';
import { registerMessageEvents } from './message-events';
import { sendFile as sendWhatsAppFile, sendText as sendWhatsAppText } from './send';
import { DEFAULT_CONFIG, type WhatsAppConfig, type WhatsAppServiceCore } from './types';
import { isAllowedNumber } from './security';
import {
  applyWhatsAppPersonalizationUpdate,
  normalizeWhatsAppConfig,
  type WhatsAppPersonalizationUpdate,
} from './personalization';
import { normalizePhoneNumber } from './phone-utils';
import {
  WhatsAppConversationHistoryStore,
  type WhatsAppConversationHistoryFilters,
  type WhatsAppConversationHistoryInput,
} from './history';

export class WhatsAppService extends EventEmitter implements WhatsAppServiceCore {
  sock: WASocket | null = null;
  config: WhatsAppConfig = { ...DEFAULT_CONFIG };
  connected = false;
  qrDataUrl: string | null = null;
  phoneNumber: string | null = null;
  reconnectAttempts = 0;
  maxReconnectAttempts = 5;
  groupContext = new Map<string, Array<{ sender: string; text: string; timestamp: number }>>();
  history = new WhatsAppConversationHistoryStore();

  async init(): Promise<void> { this.config = await loadConfig(); }

  async connect(): Promise<void> {
    if (this.sock) { this.emit('status', this.getStatus()); return; }
    await fs.mkdir(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();
    this.sock = makeWASocket({
      version,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      logger,
      printQRInTerminal: false,
      generateHighQualityLinkPreview: false,
      getMessage: async () => undefined,
    });
    registerConnectionEvents(this, saveCreds);
    registerMessageEvents(this);
  }

  async disconnect(): Promise<void> {
    if (!this.sock) return;
    await this.sock.logout();
    this.sock = null;
    this.connected = false;
    this.qrDataUrl = null;
    this.phoneNumber = null;
    this.config.autoConnect = false;
    await saveConfig(this.config);
    this.emit('status', this.getStatus());
  }

  sendText(jid: string, text: string): Promise<void> { return sendWhatsAppText(this, jid, text); }
  sendFile(jid: string, filePath: string, caption?: string): Promise<void> { return sendWhatsAppFile(this, jid, filePath, caption); }
  recordHistory(event: WhatsAppConversationHistoryInput): void {
    void this.history.append(event);
  }
  getConversationHistory(filters?: WhatsAppConversationHistoryFilters) {
    return this.history.list(filters);
  }
  getConversationHistoryStats() {
    return this.history.getStats();
  }
  isConnected(): boolean { return this.connected; }
  isAllowedNumber(number: string): boolean { return isAllowedNumber(this.config, number); }
  getBotNumber(): string { return this.sock?.user?.id?.split(':')[0] || ''; }
  async setAllowedNumbers(numbers: string[]): Promise<void> {
    const allowedNumbers = numbers.map(normalizePhoneNumber).filter(Boolean);
    this.config = normalizeWhatsAppConfig({
      ...this.config,
      allowedNumbers,
      whitelistEnabled: allowedNumbers.length > 0 && this.config.whitelistEnabled,
    });
    await saveConfig(this.config);
  }
  async setPersonalization(update: WhatsAppPersonalizationUpdate): Promise<void> {
    this.config = applyWhatsAppPersonalizationUpdate(this.config, update);
    await saveConfig(this.config);
  }
  async saveApiKey(apiKey: string): Promise<void> { this.config.apiKey = apiKey; await saveConfig(this.config); }
  async getSavedApiKey(): Promise<string | undefined> { return (await loadConfig()).apiKey; }

  getStatus() {
    return {
      connected: this.connected,
      phoneNumber: this.phoneNumber,
      qr: this.qrDataUrl,
      allowedNumbers: this.config.allowedNumbers,
      whitelistEnabled: this.config.whitelistEnabled,
      groupPolicy: this.config.groupPolicy,
      groupActivation: this.config.groupActivation,
      groupPrefix: this.config.groupPrefix,
      allowedGroups: this.config.allowedGroups,
      groupAllowFrom: this.config.groupAllowFrom,
      globalPersonalization: this.config.globalPersonalization,
      contactPersonalizations: this.config.contactPersonalizations,
      groupPersonalizations: this.config.groupPersonalizations,
    };
  }

  async setGroupConfig(config: Partial<Pick<WhatsAppConfig, 'groupPolicy' | 'groupActivation' | 'groupPrefix' | 'allowedGroups' | 'groupAllowFrom'>>): Promise<void> {
    this.config = normalizeWhatsAppConfig({ ...this.config, ...config });
    await saveConfig(this.config);
  }

  async shouldAutoConnect(): Promise<boolean> {
    const config = await loadConfig();
    try {
      await fs.access(AUTH_DIR);
      return config.autoConnect && (await fs.readdir(AUTH_DIR)).length > 0;
    } catch {
      return false;
    }
  }
}
