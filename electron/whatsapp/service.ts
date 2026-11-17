import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import type { WASocket } from '@whiskeysockets/baileys';
import { AUTH_DIR, loadConfig, saveConfig } from './config';
import { sendFile as sendWhatsAppFile, sendText as sendWhatsAppText, sendVoiceNote as sendWhatsAppVoiceNote } from './send';
import { voiceCallSessions } from '../voice-call/session-store';
import { DEFAULT_CONFIG, type WhatsAppConfig, type WhatsAppDeliveryError, type WhatsAppServiceCore } from './types';
import { isAllowedNumber } from './security';
import {
  applyWhatsAppAccessConfigUpdate,
  applyWhatsAppPersonalizationUpdate,
  normalizeWhatsAppConfig,
  type WhatsAppAccessConfigUpdate,
  type WhatsAppPersonalizationUpdate,
} from './personalization';
import { normalizePhoneNumber } from './phone-utils';
import {
  WhatsAppConversationHistoryStore,
  type WhatsAppConversationHistoryFilters,
  type WhatsAppConversationHistoryInput,
} from './history';
import type { CommunicationHubService } from '../communication-hub/service';
import { canUseProtectedFeature } from '../main/require-auth';
import { onAuthStateChange } from '../main/auth-state';
import { cancelWhatsAppReconnect } from './reconnect';

export class WhatsAppService extends EventEmitter implements WhatsAppServiceCore {
  private connectionAttempt: { promise: Promise<void>; cancel: () => void } | null = null;
  sock: WASocket | null = null;
  config: WhatsAppConfig = { ...DEFAULT_CONFIG };
  connected = false;
  qrDataUrl: string | null = null;
  phoneNumber: string | null = null;
  reconnectAttempts = 0;
  maxReconnectAttempts = 5;
  lastDeliveryError: WhatsAppDeliveryError | null = null;
  groupContext = new Map<string, Array<{ sender: string; text: string; timestamp: number }>>();
  history = new WhatsAppConversationHistoryStore();
  communicationHubService: CommunicationHubService | null = null;

  async init(): Promise<void> { this.config = await loadConfig(); }
  setCommunicationHubService(service: CommunicationHubService): void { this.communicationHubService = service; }

  connect(): Promise<void> {
    // Negacion por defecto: sin sesion en el Hub no se establece la conexion de
    // WhatsApp. Cubre autoconexion de arranque y cualquier conexion manual.
    if (!canUseProtectedFeature()) {
      console.warn('[AUTH] WhatsApp bloqueado: no hay sesion iniciada en Soflia Hub.');
      return Promise.resolve();
    }
    cancelWhatsAppReconnect(this);
    if (this.sock) { this.emit('status', this.getStatus()); return Promise.resolve(); }
    if (this.connectionAttempt) return this.connectionAttempt.promise;
    let valid = true;
    let unsubscribe = () => {};
    const attempt = { promise: Promise.resolve(), cancel: () => {
      valid = false; unsubscribe();
      if (this.connectionAttempt === attempt) this.connectionAttempt = null;
    } };
    this.connectionAttempt = attempt;
    unsubscribe = onAuthStateChange(attempt.cancel);
    const current = () => valid && this.connectionAttempt === attempt && canUseProtectedFeature();
    attempt.promise = (async () => {
      const { openWhatsAppConnection } = await import('./connection-runtime');
      if (current()) await openWhatsAppConnection(this, current);
    })().finally(attempt.cancel);
    return attempt.promise;
  }

  async disconnect(): Promise<void> {
    cancelWhatsAppReconnect(this);
    const preparing = Boolean(this.connectionAttempt);
    this.connectionAttempt?.cancel();
    if (!this.sock) {
      if (preparing) { this.config.autoConnect = false; await saveConfig(this.config); }
      return;
    }
    // Una sesion de modo llamada sobre un canal caido solo serviria para
    // intentar hablar por un transporte que ya no existe.
    voiceCallSessions.closeChannel('whatsapp');
    const socket = this.sock;
    this.sock = null;
    this.connected = false;
    this.qrDataUrl = null;
    this.phoneNumber = null;
    this.config.autoConnect = false;
    try { await socket.logout(); }
    finally {
      try { socket.end?.(undefined); } catch { console.warn('[WhatsApp] No se pudo cerrar el transporte saliente.'); }
      await saveConfig(this.config);
      this.emit('status', this.getStatus());
    }
  }

  sendText(jid: string, text: string): Promise<void> { return sendWhatsAppText(this, jid, text); }
  sendFile(jid: string, filePath: string, caption?: string): Promise<void> { return sendWhatsAppFile(this, jid, filePath, caption); }
  sendVoiceNote(jid: string, audio: Buffer, seconds: number): Promise<void> { return sendWhatsAppVoiceNote(this, jid, audio, seconds); }
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
  async setAccessConfig(update: WhatsAppAccessConfigUpdate): Promise<void> {
    this.config = applyWhatsAppAccessConfigUpdate(this.config, update);
    await saveConfig(this.config);
  }
  async saveApiKey(apiKey: string): Promise<void> { this.config.apiKey = apiKey; await saveConfig(this.config); }
  async getSavedApiKey(): Promise<string | undefined> { return (await loadConfig()).apiKey; }

  getStatus() {
    return {
      connected: this.connected,
      phoneNumber: this.phoneNumber,
      lastDeliveryError: this.lastDeliveryError,
      qr: this.qrDataUrl,
      allowedNumbers: this.config.allowedNumbers,
      whitelistEnabled: this.config.whitelistEnabled,
      masterNumber: this.config.masterNumber,
      masterPermissions: this.config.masterPermissions,
      contactPermissions: this.config.contactPermissions,
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
